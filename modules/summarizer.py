import os
import json
import logging
from typing import Dict, Any, Optional
from modules.llm_service import LLMService

logger = logging.getLogger(__name__)

CACHE_FILE = os.path.join("data", "cache_summaries.json")


SUMMARIZER_PROMPTS = {
    "Cơ bản": """Bạn là chuyên gia sư phạm tóm lược kiến thức. Hãy tóm tắt tài liệu thành một bản tổng kết ngắn gọn (TL;DR) gồm 3-5 luận điểm cốt lõi nhất.
QUY TẮC BẮT BUỘC:
- Định dạng mỗi luận điểm: - **[Tên luận điểm]**: [Giải thích chi tiết từ 2-3 câu văn mạch lạc, nêu rõ bản chất và ý nghĩa].
- TUYỆT ĐỐI KHÔNG chỉ liệt kê tiêu đề cụt ngủn hoặc các gạch đầu dòng con trống rỗng không có nội dung.
- Viết câu văn rõ ràng, súc tích, người đọc nắm được ngay bức tranh toàn cảnh.""",
    
    "Trung bình": """Bạn là trợ lý học thuật biên soạn tài liệu ôn thi đại học. Hãy trình bày bản tóm tắt học tập theo đúng 2 phần lớn:

PHẦN 1: CÁC NGUYÊN LÝ & KHÁI NIỆM CỐT LÕI
- Trình bày 3-4 khái niệm hoặc nguyên lý quan trọng nhất.
- Mỗi mục viết theo định dạng: - **[Tên khái niệm]**: [Viết đoạn văn giải thích hoàn chỉnh từ 2-4 câu phân tích rõ định nghĩa, bản chất và vai trò cốt lõi].
- TUYỆT ĐỐI KHÔNG chia nhỏ thành các gạch đầu dòng con rời rạc không có nội dung.

PHẦN 2: TRỌNG TÂM ÔN THI & BÀI HỌC VẬN DỤNG
- Trình bày 2-3 chủ đề ôn thi trọng tâm. Mỗi chủ đề viết: - **[Chủ đề/Câu hỏi ôn thi]**: [Đoạn hướng dẫn 2-3 câu phân tích cách tiếp cận, điểm mấu chốt cần ghi nhớ khi làm bài thi].

QUY TẮC: Tập trung vào chiều sâu kiến thức và tính hữu ích. Mọi mục đều phải có nội dung phân tích đầy đủ, không để tiêu đề rỗng.""",

    "Nâng cao": """Bạn là giảng viên đại học chuyên gia biên soạn giáo trình. Hãy phân tích chuyên sâu tài liệu theo đúng 3 phần:

PHẦN 1: BỐI CẢNH LÝ THUYẾT & TỔNG QUAN
- Viết 1-2 đoạn văn phân tích sâu sắc về vị trí, nguồn gốc và ý nghĩa nền tảng của chủ đề trong toàn bộ hệ thống lý luận.

PHẦN 2: HỆ THỐNG QUY LUẬT & NGUYÊN LÝ VẬN HÀNH
- Trình bày 3-4 luận điểm/nguyên lý chủ chốt. Với mỗi luận điểm viết: - **[Tên nguyên lý]**: [Đoạn phân tích chi tiết từ 3-5 câu về cơ chế vận hành, bản chất biện chứng và tác động qua lại].

PHẦN 3: LƯU Ý KHI LÀM BÀI THI & LIÊN HỆ THỰC TIỄN
- Nêu rõ 2-3 điểm sinh viên hay nhầm lẫn khi làm bài thi và cách ứng dụng kiến thức vào thực tiễn xã hội.

QUY TẮC: Viết văn phong học thuật, đĩnh đạc, trọn vẹn, mỗi mục phải có nội dung phân tích chi tiết và sâu sắc."""
}


class DocumentSummarizer:
    def __init__(self, llm_service: Optional[LLMService] = None):
        self.llm_service = llm_service or LLMService()
        self._ensure_cache_file()

    def _ensure_cache_file(self):
        os.makedirs("data", exist_ok=True)
        if not os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "w", encoding="utf-8") as f:
                    json.dump({}, f, ensure_ascii=False)
            except Exception:
                pass

    def get_cached_summary(self, doc_name: str, level: str) -> Optional[Dict[str, Any]]:
        try:
            if os.path.exists(CACHE_FILE):
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    cache = json.load(f)
                    return cache.get(doc_name, {}).get(level)
        except Exception:
            return None
        return None

    def save_cached_summary(self, doc_name: str, level: str, summary_data: Dict[str, Any]):
        try:
            cache = {}
            if os.path.exists(CACHE_FILE):
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    cache = json.load(f)
            if doc_name not in cache:
                cache[doc_name] = {}
            cache[doc_name][level] = summary_data
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.warning(f"Không thể lưu cache tóm tắt: {e}")

    def delete_cache(self, doc_name: str):
        """Xóa vĩnh viễn dữ liệu cache của một tài liệu khi tài liệu bị xóa."""
        try:
            if os.path.exists(CACHE_FILE):
                with open(CACHE_FILE, "r", encoding="utf-8") as f:
                    cache = json.load(f)
                if doc_name in cache:
                    del cache[doc_name]
                    with open(CACHE_FILE, "w", encoding="utf-8") as f:
                        json.dump(cache, f, ensure_ascii=False, indent=2)
                    logger.info(f"[Cache] Đã xóa cache tóm tắt cho {doc_name}")
        except Exception as e:
            logger.warning(f"Không thể xóa cache cho {doc_name}: {e}")

    def summarize(
        self,
        text_content: str,
        document_title: str = "Tài liệu",
        summary_style: str = "Trung bình",
        preferred_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Tóm tắt tài liệu có tích hợp Cache siêu tốc (0.1s khi đã có cache).
        Hỗ trợ 3 cấp độ: Cơ bản, Trung bình, Nâng cao.
        """
        # Chuẩn hóa cấp độ tóm tắt
        level_key = "Trung bình"
        if "cơ bản" in summary_style.lower():
            level_key = "Cơ bản"
        elif "nâng cao" in summary_style.lower():
            level_key = "Nâng cao"

        # 1. Kiểm tra Cache trước
        cached = self.get_cached_summary(document_title, level_key)
        if cached:
            cached["from_cache"] = True
            cached["latency_sec"] = 0.05
            cached["document_title"] = document_title
            cached["summary_style"] = level_key
            return cached

        # 2. Nếu chưa có Cache: Tinh gọn prompt phù hợp theo từng cấp độ
        system_prompt = SUMMARIZER_PROMPTS.get(level_key, SUMMARIZER_PROMPTS["Trung bình"])
        
        # Chọn độ dài text an toàn và tốc độ tối ưu
        char_limits = {"Cơ bản": 3500, "Trung bình": 5500, "Nâng cao": 8000}
        limit = char_limits.get(level_key, 5500)
        safe_text = text_content[:limit]

        # max_tokens cân đối để sinh nhanh và đủ trọn vẹn kết bài
        max_toks = 450 if level_key == "Cơ bản" else (750 if level_key == "Trung bình" else 1000)

        prompt = f"""Tài liệu: {document_title}
Cấp độ tóm tắt: {level_key}

NỘI DUNG TÀI LIỆU CẦN TÓM TẮT:
\"\"\"
{safe_text}
\"\"\"

Dựa vào nội dung trên, hãy viết bản tóm tắt học tập hoàn chỉnh, mạch lạc theo đúng yêu cầu cấp độ {level_key}:"""

        res = self.llm_service.generate(
            prompt=prompt, 
            system_prompt=system_prompt,
            max_tokens=max_toks,
            num_ctx=4096,
            preferred_model=preferred_model
        )

        res["document_title"] = document_title
        res["summary_style"] = level_key

        if res.get("success"):
            # Lưu ngay vào Cache vĩnh viễn
            self.save_cached_summary(document_title, level_key, res)
            res["from_cache"] = False

        return res
