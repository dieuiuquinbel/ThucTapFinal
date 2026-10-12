import requests
import json
import sys

sys.stdout.reconfigure(encoding='utf-8')

payload = {
    "document_source": "Giao_Trinh_Mang_May_Tinh.pdf",
    "num_questions": 3,
    "difficulty": "Cơ bản"
}

try:
    print("Đang gửi yêu cầu sinh trắc nghiệm tới API...")
    res = requests.post("http://127.0.0.1:8080/api/quiz", json=payload, timeout=90)
    data = res.json()
    print("SUCCESS:", data.get("success"))
    print("MODEL:", data.get("model_used"))
    print("LATENCY:", data.get("latency_sec"), "giây")
    quiz = data.get("data", [])
    print(f"SỐ LƯỢNG CÂU HỎI: {len(quiz)}")
    print(json.dumps(quiz, ensure_ascii=False, indent=2))
except Exception as e:
    print("LỖI:", e)
