import sys
import json
import time
import unicodedata
import ollama

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from modules.vector_store import VectorStore

def evaluate_retrieval(top_k=4):
    with open("tests/benchmark_dataset.json", "r", encoding="utf-8") as f:
        benchmarks = json.load(f)

    vs = VectorStore()
    total = len(benchmarks)
    hit_top1 = 0
    hit_topk = 0
    keyword_matches = 0

    print(f"\n========================================================")
    print(f"  ĐO LƯỜNG RETRIEVAL RECALL VỚI TOP_K = {top_k}")
    print(f"========================================================\n")

    for item in benchmarks:
        qid = item["id"]
        query = unicodedata.normalize('NFC', item["query"])
        target_page = item["target_page"]
        anchor = item["keyword_anchor"]

        # Tìm kiếm vector store hiện tại
        results = vs.similarity_search(query=query, top_k=top_k, min_score=0.0)
        pages_retrieved = [r.get("page") for r in results]
        
        is_hit_top1 = (len(pages_retrieved) > 0 and pages_retrieved[0] == target_page)
        is_hit_topk = (target_page in pages_retrieved)
        
        # Kiểm tra xem từ khóa neo mục tiêu có nằm trong bất kỳ chunk nào được lấy về không
        has_anchor = any(anchor.lower() in r.get("text", "").lower() for r in results)

        if is_hit_top1:
            hit_top1 += 1
        if is_hit_topk:
            hit_topk += 1
        if has_anchor:
            keyword_matches += 1

        status_str = "OK" if (is_hit_topk and has_anchor) else "MISS"
        top1_str = f"P{pages_retrieved[0]}" if pages_retrieved else "NONE"
        all_pages_str = str(pages_retrieved)

        print(f"[{status_str:4s}] Q{qid:02d}: '{query}'")
        print(f"       -> Target: Trang {target_page} | Top-1: {top1_str} | Retrieved: {all_pages_str} | Anchor Match: {has_anchor}")

    recall_top1 = round(hit_top1 / total * 100, 1)
    recall_topk = round(hit_topk / total * 100, 1)
    anchor_rate = round(keyword_matches / total * 100, 1)

    print("\n----------------- KẾT QUẢ RETRIEVAL BASELINE -----------------")
    print(f"Tổng số câu hỏi:        {total}")
    print(f"Recall@1:               {recall_top1}% ({hit_top1}/{total})")
    print(f"Recall@{top_k}:               {recall_topk}% ({hit_topk}/{total})")
    print(f"Tỷ lệ chứa nội dung neo: {anchor_rate}% ({keyword_matches}/{total})")
    print("--------------------------------------------------------------\n")
    return {
        "top_k": top_k,
        "recall_top1": recall_top1,
        f"recall_top{top_k}": recall_topk,
        "anchor_rate": anchor_rate
    }


def evaluate_ollama_profiling(query="Khái niệm về kiến trúc phân tầng"):
    print(f"\n========================================================")
    print(f"  PROFILE CHI TIẾT OLLAMA LATENCY (METRICS NATIVE)")
    print(f"========================================================\n")
    client = ollama.Client(host="http://localhost:11434")
    norm_query = unicodedata.normalize('NFC', query)

    # Lấy thử context từ ChromaDB
    vs = VectorStore()
    chunks = vs.similarity_search(query=norm_query, top_k=2, min_score=0.0)
    context_str = "\n\n".join([f"[{i+1}] (Trang {c.get('page')}): {c.get('text')[:300]}" for i, c in enumerate(chunks)])

    prompt = f"[TÀI LIỆU]\n{context_str}\n\n[CÂU HỎI]\n{norm_query}\n\nTrả lời ngắn gọn:"

    start = time.time()
    response = client.chat(
        model="qwen2.5:7b",
        messages=[{"role": "user", "content": prompt}],
        options={
            "temperature": 0.2,
            "num_ctx": 1024,
            "num_predict": 256
        }
    )
    wall_elapsed = round(time.time() - start, 2)

    # Trích xuất các trường native do Ollama trả về
    # Thời gian trong Ollama trả về dạng nanoseconds (1s = 10^9 ns)
    total_dur_ns = response.get("total_duration", 0)
    load_dur_ns = response.get("load_duration", 0)
    prompt_eval_dur_ns = response.get("prompt_eval_duration", 0)
    eval_dur_ns = response.get("eval_duration", 0)

    prompt_eval_count = response.get("prompt_eval_count", 0)
    eval_count = response.get("eval_count", 0)

    load_sec = round(load_dur_ns / 1e9, 3)
    prompt_eval_sec = round(prompt_eval_dur_ns / 1e9, 3)
    eval_sec = round(eval_dur_ns / 1e9, 3)
    total_sec = round(total_dur_ns / 1e9, 3)

    prompt_eval_rate = round(prompt_eval_count / prompt_eval_sec, 1) if prompt_eval_sec > 0 else 0
    token_rate = round(eval_count / eval_sec, 1) if eval_sec > 0 else 0

    print(f"Model:                    {response.get('model')}")
    print(f"Tổng thời gian đo ngoài:  {wall_elapsed}s (Ollama báo: {total_sec}s)")
    print(f"1. Model Load Duration:   {load_sec}s (Model có phải nạp lại từ disk không?)")
    print(f"2. Prompt Eval Duration:  {prompt_eval_sec}s ({prompt_eval_count} tokens, Tốc độ: {prompt_eval_rate} t/s)")
    print(f"3. Sinh mã (Eval) Duration: {eval_sec}s ({eval_count} tokens sinh ra)")
    print(f"--> TỐC ĐỘ SINH THỰC TẾ:    {token_rate} TOKENS/GIÂY (Đo trên GPU RTX 4050)")
    print(f"\nNội dung trả lời ({eval_count} tokens):\n{response['message']['content']}")
    print("========================================================\n")


if __name__ == "__main__":
    evaluate_retrieval(top_k=2)
    evaluate_retrieval(top_k=4)
    evaluate_ollama_profiling()
