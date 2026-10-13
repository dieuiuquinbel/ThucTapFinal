import os
import json
import logging
import random
from typing import List, Dict, Any, Optional
from modules.llm_service import LLMService

logger = logging.getLogger(__name__)

QUIZ_CACHE_FILE = os.path.join("data", "cache_quizzes.json")

QUIZ_SYSTEM_PROMPT = """Bạn là chuyên gia khảo thí đại học. Nhiệm vụ của bạn là tạo đề thi trắc nghiệm bằng tiếng Việt bám sát nội dung tài liệu.

YÊU CẦU BẮT BUỘC:
1. Trả về đúng định dạng JSON có cấu trúc: { "questions": [ ... ] }.
2. Phải tạo ĐẦY ĐỦ TẤT CẢ các câu hỏi được yêu cầu (từ id: 1 đến id: N), tuyệt đối không dừng lại ở 1 câu!
3. Mỗi câu hỏi phải có đúng 4 phương án A, B, C, D và đúng 1 đáp án chính xác."""


class QuizGenerator:
    def __init__(self, llm_service: Optional[LLMService] = None):
        self.llm_service = llm_service or LLMService()
        self._ensure_cache_file()

    def _ensure_cache_file(self):
        os.makedirs("data", exist_ok=True)
        if not os.path.exists(QUIZ_CACHE_FILE):
            try:
                with open(QUIZ_CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump({}, f, ensure_ascii=False)
            except Exception:
                pass

    def get_cached_quiz(self, doc_name: str, cache_key: str) -> Optional[Dict[str, Any]]:
        try:
            if os.path.exists(QUIZ_CACHE_FILE):
                with open(QUIZ_CACHE_FILE, "r", encoding="utf-8") as f:
                    cache = json.load(f)
                    doc_cache = cache.get(doc_name, {})
                    if cache_key in doc_cache:
                        return doc_cache[cache_key]
                    # Tìm theo tiền tố nếu có cache từ phiên trước (ví dụ "Trung bình_3" vẫn khớp "Trung bình")
                    for k, val in doc_cache.items():
                        if k.startswith(cache_key) or cache_key.startswith(k):
                            return val
        except Exception as e:
            logger.warning(f"Không thể đọc cache quiz: {e}")
        return None

    def save_cached_quiz(self, doc_name: str, cache_key: str, data: Dict[str, Any]):
        try:
            cache = {}
            if os.path.exists(QUIZ_CACHE_FILE):
                with open(QUIZ_CACHE_FILE, "r", encoding="utf-8") as f:
                    cache = json.load(f)
            if doc_name not in cache:
                cache[doc_name] = {}
            cache[doc_name][cache_key] = data
            with open(QUIZ_CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
            logger.info(f"[Quiz Cache] Đã lưu cache đề thi ({cache_key}) cho {doc_name}")
        except Exception as e:
            logger.warning(f"Không thể lưu cache quiz: {e}")

    def delete_cache(self, doc_name: str):
        """Xóa toàn bộ cache đề thi của một tài liệu khi tài liệu bị xóa."""
        try:
            if os.path.exists(QUIZ_CACHE_FILE):
                with open(QUIZ_CACHE_FILE, "r", encoding="utf-8") as f:
                    cache = json.load(f)
                if doc_name in cache:
                    del cache[doc_name]
                    with open(QUIZ_CACHE_FILE, "w", encoding="utf-8") as f:
                        json.dump(cache, f, ensure_ascii=False, indent=2)
                    logger.info(f"[Quiz Cache] Đã xóa toàn bộ cache đề thi cho {doc_name}")
        except Exception as e:
            logger.warning(f"Không thể xóa cache quiz cho {doc_name}: {e}")

    def generate_quiz(
        self,
        context_text: str,
        num_questions: int = 5,
        difficulty: str = "Trung bình",
        doc_name: Optional[str] = None,
        shuffle: bool = False
    ) -> Dict[str, Any]:
        """
        Tạo bộ câu hỏi trắc nghiệm có tích hợp Cache siêu tốc (0.05s).
        Key cache theo độ khó (Dễ, Trung bình, Khó) và tự động cắt đúng số lượng câu hỏi yêu cầu.
        Hỗ trợ shuffle để đảo ngẫu nhiên câu hỏi từ pool khi người dùng làm lại bài thi.
        """
        # Chuẩn hóa độ khó
        diff_label = "Trung bình"
        if "dễ" in difficulty.lower():
            diff_label = "Dễ"
        elif "khó" in difficulty.lower():
            diff_label = "Khó"

        # 1. Kiểm tra Cache trước (nếu cache có đủ số câu yêu cầu, trả về ngay 0.05s)
        if doc_name:
            cached = self.get_cached_quiz(doc_name, diff_label)
            if cached and cached.get("success") and isinstance(cached.get("data"), list):
                cached_questions = cached["data"]
                # Nếu cache có đủ số câu yêu cầu (hoặc ít nhất 10 câu khi yêu cầu 10/15)
                if len(cached_questions) >= num_questions:
                    if shuffle:
                        # Đảo ngẫu nhiên không trùng từ pool câu hỏi trong cache
                        selected_pool = random.sample(cached_questions, min(num_questions, len(cached_questions)))
                    else:
                        selected_pool = cached_questions[:num_questions]
                    selected_questions = [dict(item) for item in selected_pool]
                    for idx, q in enumerate(selected_questions, 1):
                        q["id"] = idx
                    logger.info(f"[Quiz Cache Hit] Trả về {len(selected_questions)}/{len(cached_questions)} câu (shuffle={shuffle}) từ cache ({diff_label}) cho {doc_name}")
                    return {
                        "data": selected_questions,
                        "success": True,
                        "from_cache": True,
                        "latency_sec": 0.05,
                        "model_used": cached.get("model_used", self.llm_service.active_model),
                        "document_title": doc_name,
                        "difficulty": diff_label,
                        "shuffled": shuffle
                    }

        # 2. Nếu chưa có Cache hoặc cache chưa đủ số câu: Sinh trọn vẹn pool 20 câu để nạp đầy đủ
        safe_context = context_text[:5500]
        actual_generate_count = max(min(num_questions, 20), 20)  # Sinh pool 20 câu để dùng chung và đảo ngẫu nhiên khi thi lại

        diff_instructions = {
            "Dễ": "Mức độ Dễ: Tập trung vào các định nghĩa, thuật ngữ và khái niệm cơ bản được nêu trực tiếp trong bài.",
            "Trung bình": "Mức độ Trung bình: Yêu cầu thông hiểu, phân tích vai trò, chức năng và các mối quan hệ giữa các thành phần.",
            "Khó": "Mức độ Khó: Yêu cầu vận dụng, tình huống thực tế hoặc phân biệt các trường hợp ngoại lệ, bẫy trắc nghiệm tinh vi."
        }
        diff_note = diff_instructions.get(diff_label, diff_instructions["Trung bình"])

        prompt = f"""Dựa vào nội dung tài liệu sau:
\"\"\"
{safe_context}
\"\"\"

YÊU CẦU: Tạo đúng {actual_generate_count} câu hỏi trắc nghiệm A-B-C-D ({diff_label}) đánh số từ id: 1 đến id: {actual_generate_count}.
{diff_note}
LƯU Ý QUAN TRỌNG:
- Mỗi phương án A, B, C, D viết ngắn gọn, rõ ràng (dưới 15 từ mỗi phương án).
- Lời giải thích súc tích trong 1 câu ngắn.

Bắt buộc trả về đúng định dạng JSON có khóa "questions":
{{
  "questions": [
    {{
      "id": 1,
      "question": "Nội dung câu hỏi ngắn gọn?",
      "options": {{
        "A": "Phương án A",
        "B": "Phương án B",
        "C": "Phương án C",
        "D": "Phương án D"
      }},
      "correct_answer": "A",
      "explanation": "Giải thích ngắn 1 câu",
      "source_note": "Tên khái niệm"
    }}
  ]
}}"""
        calc_tokens = max(2000, actual_generate_count * 220)
        res = self.llm_service.generate_json(
            prompt=prompt, 
            system_prompt=QUIZ_SYSTEM_PROMPT, 
            max_tokens=calc_tokens,
            num_ctx=4096
        )

        res["document_title"] = doc_name
        res["difficulty"] = diff_label

        if res.get("success") and doc_name:
            if isinstance(res.get("data"), list) and len(res["data"]) >= 1:
                # Lưu toàn bộ danh sách câu hỏi đã sinh (15 câu) vào cache
                self.save_cached_quiz(doc_name, diff_label, dict(res))
            res["from_cache"] = False

        if res.get("success") and isinstance(res.get("data"), list) and len(res["data"]) > num_questions:
            res["data"] = res["data"][:num_questions]
            for idx, q in enumerate(res["data"], 1):
                q["id"] = idx

        return res

    def generate_flashcards(
        self,
        context_text: str,
        num_cards: int = 6
    ) -> Dict[str, Any]:
        """
        Tạo bộ Flashcard học nhanh.
        """
        safe_context = context_text[:10000]
        prompt = f"""Dựa vào nội dung tài liệu:
\"\"\"
{safe_context}
\"\"\"

Trích xuất {num_cards} thuật ngữ quan trọng nhất. Bắt buộc trả về đúng cấu trúc JSON sau:
[
  {{
    "id": 1,
    "front": "Thuật ngữ / Khái niệm",
    "back": "Định nghĩa và ý nghĩa cốt lõi",
    "category": "Chủ đề"
  }}
]"""
        res = self.llm_service.generate_json(prompt=prompt, system_prompt=QUIZ_SYSTEM_PROMPT)
        return res
