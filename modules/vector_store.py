import os
import re
import unicodedata
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
from modules.embedding_service import EmbeddingService


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
        min_score: float = 0.50
    ) -> List[Dict[str, Any]]:
        """
        Tìm kiếm ngữ nghĩa kết hợp Lexical Reranking nhẹ:
        1. Mở rộng ứng viên ban đầu (candidates = max(top_k * 2, 6)).
        2. Tính điểm kết hợp: 0.75 * Cosine_Similarity + 0.25 * Lexical_Score.
        3. Ưu tiên đoạn khớp từ khóa cụ thể hoặc cấu trúc định nghĩa.
        """
        where_clause = None
        if filter_source and filter_source != "Tất cả tài liệu":
            norm_source = unicodedata.normalize('NFC', filter_source)
            where_clause = {"source": norm_source}
            
        # Lấy candidate pool an toàn (tối đa bằng số chunk hiện có trong DB)
        total_in_db = self.collection.count()
        if total_in_db == 0:
            return []
        candidate_k = min(total_in_db, max(top_k * 5, 20))

        query_results = self.collection.query(
            query_texts=[query],
            n_results=candidate_k,
            where=where_clause,
            include=["documents", "metadatas", "distances"]
        )
        
        if not query_results or not query_results["documents"]:
            return []
            
        docs = query_results["documents"][0]
        metas = query_results["metadatas"][0]
        distances = query_results["distances"][0]

        query_terms = [w.lower() for w in re.findall(r'\w+', query) if len(w) > 2]
        query_lower = query.lower()
        is_definition_query = any(k in query_lower for k in ["khái niệm", "là gì", "định nghĩa"])
        is_listing_query = any(k in query_lower for k in ["bao gồm", "những tầng nào", "các tầng", "gồm những", "danh sách", "liệt kê"])

        scored_candidates = []
        for doc, meta, dist in zip(docs, metas, distances):
            semantic_score = max(0.0, 1.0 - dist)
            if semantic_score < min_score:
                continue

            doc_lower = doc.lower()
            # 1. Lexical token overlap ratio
            matched_terms = sum(1 for term in query_terms if term in doc_lower)
            lexical_ratio = (matched_terms / len(query_terms)) if query_terms else 0.0

            # 2. Điểm cộng/trừ theo mục tiêu truy vấn và độ khớp tiêu đề
            match_bonus = 0.0
            
            # Ưu tiên các chunk chứa tiêu đề hoặc cụm từ khóa chính của câu hỏi (ví dụ: "chức năng thế giới quan", "chức năng của")
            exact_phrase_matches = sum(1 for term in query_terms if f" {term} " in f" {doc_lower} ")
            if len(query_terms) > 0 and (exact_phrase_matches / len(query_terms)) > 0.6:
                match_bonus += 0.15

            # Nếu hỏi chức năng / vai trò / đặc điểm, ưu tiên chunk có tiêu đề gạch đầu dòng tương ứng
            if any(k in query_lower for k in ["chức năng", "vai trò", "ý nghĩa", "đặc điểm"]):
                if any(k in doc_lower for k in ["chức năng", "vai trò", "ý nghĩa"]):
                    match_bonus += 0.12

            if is_definition_query:
                has_definition_phrase = any(p in doc_lower for p in ["là phương pháp", "là mô hình", "là một", "được định nghĩa", "khái niệm"])
                if has_definition_phrase:
                    match_bonus += 0.10

            if is_listing_query:
                has_enumeration = bool(re.search(r'(?m)^\s*(?:\d+[\.\)]|[\•\-\*])\s+[A-ZÀ-Ỹa-zà-ỹ]', doc))
                if has_enumeration:
                    match_bonus += 0.15

            # Điểm dung hợp (Hybrid Fusion Score)
            final_score = round((0.60 * semantic_score) + (0.40 * lexical_ratio) + match_bonus, 4)

            scored_candidates.append({
                "text": doc,
                "metadata": meta,
                "score": final_score,
                "semantic_score": round(semantic_score, 4),
                "page": meta.get("page", 1),
                "source": meta.get("source", "Không rõ")
            })

        # Sắp xếp lại theo điểm dung hợp cuối cùng
        scored_candidates.sort(key=lambda x: x["score"], reverse=True)
        return scored_candidates[:top_k]

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
