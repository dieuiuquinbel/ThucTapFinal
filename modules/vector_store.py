import os
import re
import unicodedata
import logging
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
from modules.embedding_service import EmbeddingService
from rank_bm25 import BM25Okapi
try:
    from flashrank import Ranker, RerankRequest
    HAS_FLASHRANK = True
except ImportError:
    HAS_FLASHRANK = False

logger = logging.getLogger(__name__)


class VectorStore:
    def __init__(
        self, 
        persist_dir: str = "chroma_db", 
        collection_name: str = "study_documents",
        embedding_service: Optional[EmbeddingService] = None
    ):
        self.persist_dir = os.path.abspath(persist_dir)
        os.makedirs(self.persist_dir, exist_ok=True)
        
        self.client = chromadb.PersistentClient(path=self.persist_dir)
        self.embedding_service = embedding_service or EmbeddingService()
        
        self.collection = self.client.get_or_create_collection(
            name=collection_name,
            embedding_function=self.embedding_service,
            metadata={"hnsw:space": "cosine"}
        )

        # Khởi tạo Reranker siêu nhẹ (FlashRank ms-marco-TinyBERT ~3MB, chạy ONNX ~2ms)
        self.ranker = None
        if HAS_FLASHRANK:
            try:
                self.ranker = Ranker(model_name="ms-marco-TinyBERT-L-2-v2")
                logger.info("[VectorStore] Đã tải thành công FlashRank Cross-Encoder Reranker.")
            except Exception as e:
                logger.warning(f"[VectorStore] Không thể tải FlashRank: {e}")

    def add_documents(self, chunks: List[Dict[str, Any]]) -> int:
        """
        Thêm danh sách các chunk vào ChromaDB.
        """
        if not chunks:
            return 0
            
        ids = []
        documents = []
        metadatas = []
        
        for idx, chunk in enumerate(chunks):
            chunk_id = chunk["metadata"].get("chunk_id", f"chunk_{idx}")
            ids.append(chunk_id)
            documents.append(chunk["text"])
            
            # ChromaDB metadata chỉ chấp nhận str, int, float, bool
            clean_meta = {}
            for k, v in chunk["metadata"].items():
                if isinstance(v, (str, int, float, bool)):
                    clean_meta[k] = v
                else:
                    clean_meta[k] = str(v)
            metadatas.append(clean_meta)
            
        # Thêm theo batch để tránh quá tải
        batch_size = 64
        for i in range(0, len(ids), batch_size):
            end_idx = i + batch_size
            self.collection.upsert(
                ids=ids[i:end_idx],
                documents=documents[i:end_idx],
                metadatas=metadatas[i:end_idx]
            )
            
        return len(ids)

    def similarity_search(
        self, 
        query: str, 
        top_k: int = 4, 
        filter_source: Optional[str] = None,
        min_score: float = 0.40
    ) -> List[Dict[str, Any]]:
        """
        Quy trình Hybrid Search 2 giai đoạn tiên tiến (Dense BGE-M3 + BM25 + FlashRank Reranker):
        1. Giai đoạn 1 (Candidate Retrieval):
           - Lấy candidate pool (tối đa 25 đoạn) từ ChromaDB bằng Dense Vector (BGE-M3).
           - Chấm điểm BM25Okapi trên tập ứng viên.
           - Dung hợp xếp hạng qua Reciprocal Rank Fusion (RRF).
        2. Giai đoạn 2 (Cross-Encoder Reranking):
           - Đưa top 10-12 đoạn từ RRF qua mô hình FlashRank (ms-marco-TinyBERT ONNX).
           - Tinh lọc lấy top_k đoạn sát sườn nhất (mặc định 4 đoạn) để đưa vào LLM.
        """
        where_clause = None
        if filter_source and filter_source != "Tất cả tài liệu":
            norm_source = unicodedata.normalize('NFC', filter_source)
            where_clause = {"source": norm_source}
            
        total_in_db = self.collection.count()
        if total_in_db == 0:
            return []
            
        # Thu thập ứng viên (Candidate Retrieval: 20-25 đoạn)
        candidate_k = min(total_in_db, max(top_k * 5, 20))

        query_results = self.collection.query(
            query_texts=[query],
            n_results=candidate_k,
            where=where_clause,
            include=["documents", "metadatas", "distances"]
        )
        
        if not query_results or not query_results["documents"] or not query_results["documents"][0]:
            return []
            
        docs = query_results["documents"][0]
        metas = query_results["metadatas"][0]
        distances = query_results["distances"][0]

        # 1. Tính Dense Semantic Score (Cosine)
        dense_candidates = []
        for idx, (doc, meta, dist) in enumerate(zip(docs, metas, distances)):
            semantic_score = max(0.0, 1.0 - dist)
            dense_candidates.append({
                "idx": idx,
                "text": doc,
                "metadata": meta,
                "semantic_score": semantic_score,
                "dense_rank": idx + 1
            })

        # 2. Tính BM25 Sparse Score
        def tokenize(text: str) -> List[str]:
            return [w.lower() for w in re.findall(r'\w+', text) if len(w) > 1]

        tokenized_query = tokenize(query)
        tokenized_corpus = [tokenize(doc) for doc in docs]
        
        bm25_scores = [0.0] * len(docs)
        if tokenized_query and any(len(c) > 0 for c in tokenized_corpus):
            try:
                bm25 = BM25Okapi(tokenized_corpus)
                bm25_scores = bm25.get_scores(tokenized_query).tolist()
            except Exception as e:
                logger.warning(f"[VectorStore] BM25 scoring error: {e}")

        # Sắp xếp theo BM25 để lấy bm25_rank
        bm25_ranked_indices = sorted(range(len(bm25_scores)), key=lambda i: bm25_scores[i], reverse=True)
        bm25_rank_map = {idx: rank + 1 for rank, idx in enumerate(bm25_ranked_indices)}

        # 3. Dung hợp xếp hạng qua Reciprocal Rank Fusion (RRF)
        # RRF Score = 1 / (60 + dense_rank) + 1 / (60 + bm25_rank)
        for item in dense_candidates:
            idx = item["idx"]
            b_score = bm25_scores[idx]
            b_rank = bm25_rank_map[idx]
            item["bm25_score"] = round(b_score, 4)
            item["rrf_score"] = (1.0 / (60.0 + item["dense_rank"])) + (1.0 / (60.0 + b_rank))

        # Sắp xếp ứng viên theo RRF
        dense_candidates.sort(key=lambda x: x["rrf_score"], reverse=True)
        rrf_top = dense_candidates[:min(len(dense_candidates), max(top_k * 3, 10))]

        # 4. Cross-Encoder Reranking bằng FlashRank (nếu có sẵn)
        reranked_results = []
        if self.ranker and len(rrf_top) > 1:
            try:
                passages = [{"id": i, "text": item["text"]} for i, item in enumerate(rrf_top)]
                rerank_req = RerankRequest(query=query, passages=passages)
                flash_res = self.ranker.rerank(rerank_req)
                
                # Ánh xạ lại điểm rerank
                score_map = {r["id"]: r["score"] for r in flash_res}
                for i, item in enumerate(rrf_top):
                    r_score = score_map.get(i, 0.0)
                    item["rerank_score"] = round(float(r_score), 4)
                    item["final_score"] = round(0.5 * item["semantic_score"] + 0.5 * float(r_score), 4)
                    reranked_results.append(item)

                reranked_results.sort(key=lambda x: x["final_score"], reverse=True)
            except Exception as e:
                logger.warning(f"[VectorStore] FlashRank reranking error, falling back to RRF: {e}")
                reranked_results = rrf_top
        else:
            reranked_results = rrf_top

        # 5. Định dạng đầu ra sạch sẽ kèm metadata & lọc min_score
        final_chunks = []
        for item in reranked_results:
            score = item.get("final_score", round(item.get("semantic_score", 0.0), 4))
            # Loại bỏ triệt để các đoạn văn bản có độ tương quan dưới ngưỡng tối thiểu
            if min_score is not None and score < min_score:
                continue
            meta = item.get("metadata", {})
            final_chunks.append({
                "text": item["text"],
                "metadata": meta,
                "score": score,
                "semantic_score": round(item.get("semantic_score", 0.0), 4),
                "bm25_score": item.get("bm25_score", 0.0),
                "rerank_score": item.get("rerank_score", 0.0),
                "page": meta.get("page", 1),
                "source": meta.get("source", "Không rõ")
            })
            if len(final_chunks) >= top_k:
                break

        return final_chunks

    def list_documents(self) -> List[Dict[str, Any]]:
        """
        Liệt kê danh sách các tài liệu đã được index trong database.
        """
        data = self.collection.get(include=["metadatas"])
        if not data or not data["metadatas"]:
            return []
            
        doc_summary = {}
        for meta in data["metadatas"]:
            src = meta.get("source", "Tài liệu không tên")
            page = meta.get("page", 1)
            if src not in doc_summary:
                doc_summary[src] = {
                    "source": src,
                    "chunk_count": 0,
                    "pages": set()
                }
            doc_summary[src]["chunk_count"] += 1
            doc_summary[src]["pages"].add(page)
            
        return [
            {
                "source": k,
                "chunks": v["chunk_count"],
                "total_pages": len(v["pages"])
            }
            for k, v in doc_summary.items()
        ]

    def get_document_chunks_sampled(self, source_filename: str, max_chunks: int = 8) -> List[Dict[str, Any]]:
        """
        Lấy các chunk đại diện phân bố đều xuyên suốt toàn bộ tài liệu (tránh bỏ sót các chương).
        Dùng cho Tóm tắt, Quiz và Flashcard để đảm bảo tính bao phủ (Coverage).
        """
        where_clause = None
        if source_filename and source_filename != "Tất cả tài liệu":
            where_clause = {"source": source_filename}

        data = self.collection.get(
            where=where_clause,
            include=["documents", "metadatas"]
        )
        if not data or not data["documents"]:
            return []

        docs = data["documents"]
        metas = data["metadatas"]

        # Gom và sắp xếp theo số trang và chunk_index
        all_chunks = []
        for d, m in zip(docs, metas):
            all_chunks.append({
                "text": d,
                "metadata": m,
                "page": m.get("page", 1),
                "chunk_index": m.get("chunk_index", 0),
                "source": m.get("source", source_filename)
            })

        all_chunks.sort(key=lambda c: (c["page"], c["chunk_index"]))

        if len(all_chunks) <= max_chunks:
            return all_chunks

        # Lấy mẫu đều theo bước nhảy (stride) để có đại diện từ đầu đến cuối tài liệu
        step = len(all_chunks) / max_chunks
        sampled = [all_chunks[int(i * step)] for i in range(max_chunks)]
        return sampled

    def delete_document(self, source_filename: str) -> bool:
        """
        Xóa toàn bộ các chunk của một tài liệu theo tên file.
        """
        try:
            self.collection.delete(where={"source": source_filename})
            return True
        except Exception as e:
            print(f"Lỗi khi xóa tài liệu {source_filename}: {e}")
            return False

    def clear_all(self):
        """
        Xóa trắng collection.
        """
        self.client.delete_collection(self.collection.name)
        self.collection = self.client.get_or_create_collection(
            name="study_documents",
            embedding_function=self.embedding_service,
            metadata={"hnsw:space": "cosine"}
        )
