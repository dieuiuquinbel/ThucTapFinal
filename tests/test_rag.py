import requests
import json

payload = {
    "query": "Nêu quá trình bắt tay ba bước trong giao thức TCP?",
    "filter_source": "Giao_Trinh_Mang_May_Tinh.pdf",
    "top_k": 3
}

try:
    res = requests.post("http://127.0.0.1:8080/api/chat", json=payload, timeout=60)
    data = res.json()
    print("SUCCESS:", data.get("success"))
    print("MODEL USED:", data.get("model_used"))
    print("LATENCY:", data.get("latency_sec"), "giây")
    print(f"SOURCES: {len(data.get('sources', []))} vị trí tham chiếu:")
    for s in data.get("sources", []):
        print(f"  - {s['source']} (Trang {s['page']}) -> Khớp: {s['score']*100:.1f}%")
    print("\n--- CÂU TRẢ LỜI CỦA QWEN 2.5 7B ---\n")
    print(data.get("answer", ""))
except Exception as e:
    print("LỖI:", e)
