import re
import logging
from typing import List, Dict, Any, Optional
from modules.vector_store import VectorStore
from modules.llm_service import LLMService

logger = logging.getLogger(__name__)


# --- Conversation Context Memory ---
# Các từ chỉ thị thay thế đại từ rõ ràng (anaphora) trong ngữ cảnh
FOLLOW_UP_INDICATORS = [
    "nó", "chúng", "cái đó", "điều đó", "ở trên", "vừa nói",
    "kể thêm", "nói rõ hơn", "còn gì nữa", "chi tiết hơn",
    "them", "those", "that", "it", "its"
]


def is_follow_up_query(query: str) -> bool:
    """
    Chỉ coi là câu hỏi tiếp nối khi câu hỏi thật sự thiếu tân ngữ/chủ ngữ độc lập:
    1. Câu cực ngắn (< 15 ký tự, ví dụ: 'còn gì nữa?', 'tại sao?')
    2. Chứa đại từ chỉ thị thay thế rõ ràng (nó, cái đó, điều đó...)
    Không bắt các từ 'các', 'những', 'tại sao' ở câu độc lập.
    """
    q = query.strip().lower()
    if len(q) < 15:
        return True
    
    # Kiểm tra theo ranh giới từ (word boundary) thay vì substring thông thường
    for indicator in FOLLOW_UP_INDICATORS:
        if re.search(rf'\b{re.escape(indicator)}\b', q):
            return True
    return False


def reformulate_query(current_query: str, history: List[Dict[str, str]]) -> str:
    """
    Ghép ngữ cảnh hội thoại trước đó vào câu hỏi hiện tại để vector search hiểu được.
    
    Ví dụ:
        History: [user: "Mô hình OSI có mấy tầng?", assistant: "7 tầng..."]
        Current: "Bao gồm những tầng nào?"
        → Reformulated: "Mô hình OSI bao gồm những tầng nào?"
    """
    if not history:
        return current_query
    
    # Lấy câu hỏi user gần nhất từ history
    last_user_query = ""
    last_assistant_answer = ""
    for msg in reversed(history):
        if msg.get("role") == "assistant" and not last_assistant_answer:
            last_assistant_answer = msg.get("content", "")[:150]
        if msg.get("role") == "user" and not last_user_query:
            last_user_query = msg.get("content", "")
        if last_user_query and last_assistant_answer:
            break
    
    if not last_user_query:
        return current_query
    
    # Làm sạch câu hỏi trước đó để lấy thực thể chủ đề (bỏ các từ để hỏi: có mấy, là gì, thế nào...)
    cleaned_topic = re.sub(r'(?i)\b(có\s+mấy|là\s+gì|như\s+thế\s+nào|được\s+định\s+nghĩa|ở\s+đâu|\?)\b', '', last_user_query).strip()
    if cleaned_topic:
        reformulated = f"{cleaned_topic} {current_query}".strip()
    else:
        reformulated = f"{last_user_query} {current_query}".strip()

    logger.info(f"[Context Memory] Reformulated: '{current_query}' → '{reformulated}'")
    return reformulated


def format_history_for_prompt(history: List[Dict[str, str]], max_turns: int = 3) -> str:
    """
    Định dạng lịch sử hội thoại gần nhất thành chuỗi để đưa vào prompt LLM.
    Chỉ lấy tối đa max_turns cặp hỏi-đáp gần nhất để không phình prompt.
    """
    if not history:
        return ""
    
    # Lấy tối đa max_turns*2 messages gần nhất (mỗi turn = 1 user + 1 assistant)
    recent = history[-(max_turns * 2):]
    
    lines = ["[LỊCH SỬ HỘI THOẠI]"]
    for msg in recent:
        role = msg.get("role", "")
        content = msg.get("content", "").strip()
        if not content:
            continue
        # Cắt bớt câu trả lời dài để tiết kiệm context window
        if role == "assistant" and len(content) > 200:
            content = content[:200] + "..."
        if role == "user":
            lines.append(f"Người dùng: {content}")
        elif role == "assistant":
            lines.append(f"Trợ lý: {content}")
    
    if len(lines) <= 1:
        return ""
    return "\n".join(lines)


# Các mẫu câu chào hỏi / giao tiếp xã giao thông thường
GREETING_PATTERNS = [
    r'^(xin\s+)?chào(\s+bạn|\s+ad|\s+bot|\s+trợ\s+lý)?[\s!\.\?]*$',
    r'^(hello|hi|hey)[\s!\.\?]*$',
    r'^(bạn\s+là\s+ai|bạn\s+có\s+thể\s+làm\s+gì|giới\s+thiệu\s+bản\s+thân)[\s!\.\?]*$',
    r'^(cảm\s+ơn|thanks|thank\s+you)[\s!\.\?]*$'
]

def is_conversational_query(query: str) -> Optional[str]:
    """
    Nhận diện câu chào hỏi, giao tiếp cơ bản để trả lời tự nhiên mà không ép tìm trong tài liệu.
    """
    q = query.strip().lower()
    for pattern in GREETING_PATTERNS:
        if re.search(pattern, q):
            if "cảm ơn" in q or "thank" in q:
                return "Rất vui được hỗ trợ bạn! Nếu có câu hỏi nào về nội dung tài liệu học tập, bạn cứ hỏi tôi nhé."
            return "Xin chào! Bạn có thể đặt câu hỏi về nội dung tài liệu đã tải lên, hoặc sử dụng các tính năng Luyện thi trắc nghiệm và Tóm tắt ở các tab phía trên để ôn tập nhé."
    return None


RAG_SYSTEM_PROMPT = """Bạn là Trợ lý Học thuật Đại học. Bạn CHỈ ĐƯỢC PHÉP trả lời dựa trên các đoạn ngữ cảnh [NGUỒN 1], [NGUỒN 2]... được cung cấp.

QUY TẮC BẮT BUỘC ĐỂ ĐẢM BẢO TÍNH HỌC THUẬT VÀ TRUNG THỰC:
1. CHỈ TRẢ LỜI TỪ NGỮ CẢNH ĐƯỢC CUNG CẤP: Tuyệt đối không tự suy diễn hoặc bổ sung kiến thức bên ngoài nếu tài liệu không đề cập.
2. BẮT BUỘC DẪN NGUỒN: Mỗi luận điểm, định nghĩa hoặc số liệu, bạn BẮT BUỘC phải ghi kèm số hiệu nguồn [1], [2]... ngay sau câu đó (ví dụ: "TCP là giao thức hướng kết nối [1].").
3. TRƯỜNG HỢP KHÔNG ĐỦ THÔNG TIN: Nếu ngữ cảnh không có thông tin hoặc không đủ tài liệu để trả lời, hãy trả lời chính xác:
   "Tài liệu hiện tại không có thông tin về vấn đề này. Bạn có thể mở rộng phạm vi tìm kiếm hoặc chọn tài liệu khác."
4. TRÌNH BÀY MẠCH LẠC: Trình bày súc tích bằng các tiêu đề in đậm và gạch đầu dòng rõ ràng. Tuyệt đối không tự bịa danh sách nguồn ở cuối câu trả lời."""


class RAGPipeline:
    def __init__(
        self,
        vector_store: Optional[VectorStore] = None,
        llm_service: Optional[LLMService] = None
    ):
        self.vector_store = vector_store or VectorStore()
        self.llm_service = llm_service or LLMService()

    def format_context(self, retrieved_chunks: List[Dict[str, Any]]) -> str:
        """
        Định dạng các đoạn văn bản truy xuất thành khối ngữ cảnh có số thứ tự [1], [2]... rõ ràng.
        """
        context_blocks = []
        for idx, chunk in enumerate(retrieved_chunks, 1):
            src = chunk.get("source", "Không rõ nguồn")
            page = chunk.get("page", 1)
            heading = chunk.get("metadata", {}).get("heading") or chunk.get("heading")
            heading_str = f" • Mục: {heading}" if heading and heading != "Tổng quan" else ""
            text = chunk.get("text", "").strip()
            block = f"--- [NGUỒN {idx}] (Tệp: {src} • Trang {page}{heading_str}) ---\n{text}"
            context_blocks.append(block)
        return "\n\n".join(context_blocks)

    def filter_actually_cited_sources(self, answer_text: str, retrieved_chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Lọc danh sách nguồn: chỉ giữ lại những đoạn [X] thực sự được LLM trích dẫn trong câu trả lời.
        Nếu LLM không trích dẫn cụ thể hoặc trả lời không tìm thấy, chỉ trả về nguồn có liên quan thực sự.
        """
        if "không tìm thấy" in answer_text.lower():
            return []

        cited_indices = set(re.findall(r'\[(\d+)\]', answer_text))
        
        # Nếu model có trích dẫn [1], [2]... thì lọc chính xác
        if cited_indices:
            used_sources = []
            for idx_str in sorted(cited_indices, key=int):
                idx = int(idx_str) - 1
                if 0 <= idx < len(retrieved_chunks):
                    chunk = retrieved_chunks[idx]
                    heading = chunk.get("metadata", {}).get("heading") or chunk.get("heading")
                    used_sources.append({
                        "source": chunk.get("source"),
                        "page": chunk.get("page"),
                        "heading": heading if heading != "Tổng quan" else None,
                        "score": chunk.get("score"),
                        "snippet": chunk.get("text", "")[:180] + "..."
                    })
            if used_sources:
                return used_sources

        # Nếu câu trả lời không chứa bất kỳ thẻ trích dẫn [X] nào:
        # TUYỆT ĐỐI KHÔNG đoán mò trả lại toàn bộ chunk retrieved để tránh hiện nguồn thừa.
        # Trả về danh sách rỗng để hệ thống đánh dấu "Chưa xác thực nguồn".
        return []

    def answer_query(
        self,
        query: str,
        top_k: int = 4,
        filter_source: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None
    ) -> Dict[str, Any]:
        """
        Thực hiện quy trình RAG có nhớ ngữ cảnh hội thoại:
        1. Nhận diện giao tiếp tự nhiên.
        2. Nếu là câu hỏi tiếp nối → reformulate query dựa trên lịch sử.
        3. Đưa lịch sử hội thoại vào prompt để LLM trả lời mạch lạc.
        """
        conv_reply = is_conversational_query(query)
        if conv_reply:
            return {
                "answer": conv_reply,
                "sources": [],
                "raw_retrieved": [],
                "model_used": self.llm_service.active_model,
                "is_fallback": False,
                "latency_sec": 0.05,
                "success": True
            }

        # Reformulate nếu là câu hỏi tiếp nối
        search_query = query
        if history and is_follow_up_query(query):
            search_query = reformulate_query(query, history)

        retrieved = self.vector_store.similarity_search(
            query=search_query,
            top_k=top_k,
            filter_source=filter_source,
            min_score=0.45
        )

        if not retrieved:
            return {
                "answer": "Không tìm thấy thông tin phù hợp trong tài liệu đã tải lên (độ tương đồng ngữ nghĩa thấp).",
                "sources": [],
                "model_used": "None",
                "is_fallback": False,
                "latency_sec": 0,
                "success": True
            }

        context_str = self.format_context(retrieved)
        history_str = format_history_for_prompt(history) if history else ""
        
        prompt = f"""[TÀI LIỆU]
{context_str}

{history_str}

[CÂU HỎI]
{query}

Dựa vào các đoạn nguồn trên, hãy trả lời ĐẦY ĐỦ, CHI TIẾT và TOÀN DIỆN, phân tích rõ từng ý/mục và ghi rõ số trích dẫn [1], [2]... ngay sau thông tin tương ứng:"""

        res = self.llm_service.generate(prompt=prompt, system_prompt=RAG_SYSTEM_PROMPT, max_tokens=1024)
        
        # Chỉ trả về nguồn thật sự được trích dẫn trong văn bản
        actually_used_sources = self.filter_actually_cited_sources(res["text"], retrieved)

        return {
            "answer": res["text"],
            "sources": actually_used_sources,
            "raw_retrieved": retrieved,
            "model_used": res.get("model_used", "Unknown"),
            "is_fallback": res.get("is_fallback", False),
            "latency_sec": res.get("latency_sec", 0),
            "success": res.get("success", False)
        }

    def answer_query_stream(
        self,
        query: str,
        top_k: int = 4,
        filter_source: Optional[str] = None,
        history: Optional[List[Dict[str, str]]] = None
    ):
        """
        Streaming trả lời RAG có nhớ ngữ cảnh hội thoại:
        1. Xử lý câu chào hỏi tức thì.
        2. Nếu là follow-up → reformulate query với ngữ cảnh trước đó.
        3. Stream toàn bộ token chữ trước để người dùng thấy phản hồi ngay.
        4. Sau khi kết thúc, phân tích và chỉ gửi các nguồn THỰC SỰ được trích dẫn.
        """
        conv_reply = is_conversational_query(query)
        if conv_reply:
            yield {"type": "token", "token": conv_reply}
            yield {"type": "meta", "sources": [], "model": self.llm_service.active_model}
            return

        # Reformulate nếu là câu hỏi tiếp nối
        search_query = query
        if history and is_follow_up_query(query):
            search_query = reformulate_query(query, history)

        retrieved = self.vector_store.similarity_search(
            query=search_query,
            top_k=top_k,
            filter_source=filter_source,
            min_score=0.45
        )

        if not retrieved:
            yield {"type": "token", "token": "Không tìm thấy thông tin phù hợp trong tài liệu đã tải lên (độ tương đồng ngữ nghĩa thấp)."}
            yield {"type": "meta", "sources": [], "model": "None"}
            return

        context_str = self.format_context(retrieved)
        history_str = format_history_for_prompt(history) if history else ""
        
        prompt = f"""[TÀI LIỆU]
{context_str}

{history_str}

[CÂU HỎI]
{query}

Dựa vào các đoạn nguồn trên, hãy trả lời ĐẦY ĐỦ, CHI TIẾT và TOÀN DIỆN, phân tích rõ từng ý/mục và ghi rõ số trích dẫn [1], [2]... ngay sau thông tin tương ứng:"""

        accumulated_text = ""
        for token in self.llm_service.generate_stream(prompt=prompt, system_prompt=RAG_SYSTEM_PROMPT, max_tokens=1024):
            accumulated_text += token
            yield {"type": "token", "token": token}

        # Sau khi hoàn tất sinh token, lọc chính xác các nguồn thực sự được trích dẫn
        actually_used_sources = self.filter_actually_cited_sources(accumulated_text, retrieved)
        yield {
            "type": "meta",
            "sources": actually_used_sources,
            "model": self.llm_service.active_model,
            "has_unverified_citation": (len(actually_used_sources) == 0 and "không tìm thấy" not in accumulated_text.lower())
        }
