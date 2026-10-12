import sys
import json
import time
import unicodedata

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from modules.vector_store import VectorStore
from modules.rag_pipeline import RAGPipeline


def run_benchmark():
    with open("tests/test_rag_evaluation.json", "r", encoding="utf-8") as f:
        benchmarks = json.load(f)

    pipeline = RAGPipeline()
    total = len(benchmarks)
    retrieval_hits = 0
    concept_hits = 0

    print("=================================================================")
    print(f"  CHẠY BỘ KIỂM THỬ ĐÁNH GIÁ ĐỊNH LƯỢNG RAG ({total} CÂU HỎI)")
    print("=================================================================\n")

    history_cache = {}

    for item in benchmarks:
        qid = item["id"]
        qtype = item["type"]
        query = unicodedata.normalize('NFC', item["query"])
        expected = [unicodedata.normalize('NFC', c.lower()) for c in item["expected_concepts"]]

        history = None
        if qtype == "follow_up":
            base_id = item.get("base_id")
            if base_id in history_cache:
                history = history_cache[base_id]

        start_time = time.time()
        res = pipeline.answer_query(query=query, top_k=4, history=history)
        elapsed = round(time.time() - start_time, 2)

        answer = unicodedata.normalize('NFC', res.get("answer", ""))
        answer_lower = answer.lower()
        sources = res.get("raw_retrieved", [])
        cited_sources = res.get("sources", [])
        
        # 1. Kiểm tra retrieval: tỷ lệ các khái niệm mong đợi xuất hiện trong các chunk nguồn
        combined_source_text = " ".join([s.get("text", "").lower() for s in sources])
        retrieval_matched = [c for c in expected if c in combined_source_text]
        retrieval_coverage = len(retrieval_matched) / len(expected)
        retrieval_ok = retrieval_coverage >= 0.5  # Phải xuất hiện ít nhất một nửa số khái niệm mong đợi
        if retrieval_ok:
            retrieval_hits += 1

        # 2. Kiểm tra câu trả lời: tỷ lệ khái niệm mong đợi được AI giải thích
        answer_matched = [c for c in expected if c in answer_lower]
        answer_coverage = len(answer_matched) / len(expected)
        answer_ok = answer_coverage >= 0.5  # Phải giải thích được đa số khái niệm cốt lõi

        # 3. Kiểm tra trích dẫn và ảo giác (Citation & Groundedness)
        has_citation = bool(re.search(r'\[\d+\]', answer))
        is_hallucinating = (not retrieval_ok and answer_ok)  # Đoán mò khi nguồn không có

        if answer_ok and not is_hallucinating:
            concept_hits += 1

        status = "PASSED" if (retrieval_ok and answer_ok and has_citation) else "FAILED"
        print(f"[{status}] Q{qid:02d} ({qtype:11s}) ({elapsed}s): {query}")
        print(f"       -> Expected ({len(expected)}): {expected}")
        print(f"       -> Retrieval: {len(retrieval_matched)}/{len(expected)} ({round(retrieval_coverage*100)}%) | Pages: {[s.get('page') for s in sources]}")
        print(f"       -> Answer Coverage: {len(answer_matched)}/{len(expected)} ({round(answer_coverage*100)}%) | Cited: {has_citation}")
        print(f"       -> Trích đoạn câu trả lời: {answer[:130]}...\n")

        # Lưu history nếu là câu độc lập
        if qtype == "independent":
            history_cache[qid] = [
                {"role": "user", "content": query},
                {"role": "assistant", "content": answer}
            ]

    retrieval_rate = round(retrieval_hits / total * 100, 1)
    answer_rate = round(concept_hits / total * 100, 1)

    print("=================================================================")
    print(f"  KẾT QUẢ ĐÁNH GIÁ ĐỊNH LƯỢNG NGHIÊM NGẶT:")
    print(f"  - Tỷ lệ truy xuất đạt chuẩn (Retrieval Recall >= 50% ý): {retrieval_rate}% ({retrieval_hits}/{total})")
    print(f"  - Tỷ lệ trả lời đạt chuẩn (Concept Coverage >= 50% & Không bịa): {answer_rate}% ({concept_hits}/{total})")
    print("=================================================================")


if __name__ == "__main__":
    run_benchmark()
