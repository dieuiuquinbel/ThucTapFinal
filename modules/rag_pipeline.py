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
    "cho ví dụ", "giải thích thêm", "phần đó", "mục đó",
    "them", "those", "that", "it", "its"
]

# Các từ để hỏi nối tiếp rất ngắn (chỉ dùng khi câu < 20 ký tự)
SHORT_FOLLOWUP_PATTERNS = [
    r'^tại\s+sao\??$', r'^vì\s+sao\??$', r'^sao\s+vậy\??$',
    r'^còn\s+gì\s+nữa\??$', r'^rồi\s+sao\??$', r'^tiếp\s+đi\??$',
    r'^cho\s+ví\s+dụ\??$', r'^ví\s+dụ\??$',
]


def is_follow_up_query(query: str) -> bool:
    """
    Chỉ coi là câu hỏi tiếp nối khi:
    1. Câu cực ngắn VÀ khớp mẫu hỏi nối tiếp rõ ràng (tại sao?, còn gì nữa?)
    2. Chứa đại từ chỉ thị thay thế rõ ràng (nó, cái đó, điều đó...)
    KHÔNG coi câu ngắn bất kỳ là follow-up (tránh bắt nhầm lời khen, xác nhận).
    """
    q = query.strip().lower()

    # Câu cực ngắn: chỉ coi là follow-up nếu khớp mẫu hỏi nối tiếp cụ thể
    if len(q) < 20:
        for pattern in SHORT_FOLLOWUP_PATTERNS:
            if re.search(pattern, q):
                return True
        # Câu ngắn mà không khớp mẫu nối tiếp -> KHÔNG phải follow-up
        # (ví dụ: "giỏi quá", "ok", "cảm ơn" sẽ không bị bắt)

    # Kiểm tra đại từ chỉ thị theo ranh giới từ (word boundary)
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
    if not history or not is_follow_up_query(current_query):
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


# --- Nhận diện Giao tiếp Xã giao & Lời khen (Zero-latency Chit-chat) ---

# Mẫu chào hỏi
GREETING_PATTERNS = [
    r'^(xin\s+)?chào(\s+bạn|\s+ad|\s+bot|\s+trợ\s+lý|\s+nha|\s+nhé)?[\s!\.\?]*$',
    r'^(hello|hi|hey)[\s!\.\?]*$',
    r'^(bạn\s+là\s+ai|bạn\s+có\s+thể\s+làm\s+gì|giới\s+thiệu\s+bản\s+thân)[\s!\.\?]*$',
]

# Mẫu khen ngợi / tán thưởng
PRAISE_PATTERNS = [
    r'(giỏi|hay|tuyệt|tốt|chuẩn|chất|xuất\s*sắc|pro|siêu|đỉnh|quá\s+xịn|phê|max|10\s+điểm|mười\s+điểm)',
    r'(trả\s+lời\s+hay|trả\s+lời\s+tốt|trả\s+lời\s+đúng|đúng\s+rồi|chính\s+xác)',
    r'(thông\s+minh|thật\s+giỏi|quá\s+giỏi|ghê\s+thật|ưng|ưng\s+quá)',
    r'(good|great|nice|awesome|amazing|perfect|well\s+done|cool|excellent)',
]

# Mẫu cảm ơn
THANKS_PATTERNS = [
    r'(cảm\s+ơn|cám\s+ơn|thanks|thank\s+you|tks|tky|thankiu|cám\s+ơn\s+nhiều)',
]

# Mẫu xác nhận / đồng ý ngắn
ACK_PATTERNS = [
    r'^(ok|okie|oke|okay|ừ|ừm|uhm|uh|vâng|dạ|được|được\s+rồi|hiểu\s+rồi|hiểu|rõ|ra\s+rồi|ổn|hợp\s+lý|đồng\s+ý)[\s!\.\?]*$',
]

# Các từ để hỏi — nếu câu chứa từ này thì KHÔNG phải chitchat dù có từ khen
QUESTION_INDICATORS = [
    r'\?', r'\blà\s+gì\b', r'\btại\s+sao\b', r'\bvì\s+sao\b', r'\bnhư\s+thế\s+nào\b',
    r'\bbao\s+nhiêu\b', r'\bmấy\b', r'\bở\s+đâu\b', r'\bkhi\s+nào\b', r'\bcái\s+gì\b',
    r'\bwhat\b', r'\bwhy\b', r'\bhow\b', r'\bwhere\b', r'\bwhen\b',
    r'\bgiải\s+thích\b', r'\bphân\s+tích\b', r'\bso\s+sánh\b', r'\btrình\s+bày\b',
    r'\bcho\s+biết\b', r'\bnêu\b', r'\bliệt\s+kê\b', r'\bviết\b', r'\btính\b',
    r'\bhãy\b', r'\blàm\s+sao\b', r'\bcách\b',
]


def _has_question_intent(q: str) -> bool:
    """Kiểm tra câu có chứa ý định hỏi kiến thức hay không."""
    for pattern in QUESTION_INDICATORS:
        if re.search(pattern, q):
            return True
    return False


def is_conversational_query(query: str) -> Optional[str]:
    """
    Nhận diện câu chào hỏi, khen ngợi, cảm ơn, xác nhận để trả lời tự nhiên
    mà không ép tìm trong tài liệu. Có guardrail: nếu câu chứa ý định hỏi
    kiến thức (có dấu ?, từ để hỏi...) thì bỏ qua và đi vào luồng RAG.
    """
    q = query.strip().lower()

    # Guardrail: nếu có ý định hỏi kiến thức -> không phải chitchat
    if _has_question_intent(q):
        return None

    # 1. Chào hỏi
    for pattern in GREETING_PATTERNS:
        if re.search(pattern, q):
            return "Xin chào bạn! 👋 Mình là StudyEdu — trợ lý học tập của bạn. Bạn có thể hỏi mình bất kỳ câu hỏi nào về bài học, hoặc dùng các tab Luyện thi, Thẻ ghi nhớ và Tóm tắt phía trên để ôn tập nhé! 📚✨"

    # 2. Cảm ơn
    for pattern in THANKS_PATTERNS:
        if re.search(pattern, q):
            return "Không có gì đâu nè! 🌟 Rất vui vì đã giúp được bạn. Chúc bạn ôn bài thật hiệu quả và đạt điểm cao nhé! 🚀"

    # 3. Khen ngợi / tán thưởng
    for pattern in PRAISE_PATTERNS:
        if re.search(pattern, q):
            return "Cảm ơn bạn nhiều nhé! 🥰 Rất vui vì câu trả lời đã hữu ích. Nếu cần giải thích thêm phần nào hoặc muốn luyện thi thử, cứ nhắn mình nhé! ✨"

    # 4. Xác nhận / đồng ý ngắn
    for pattern in ACK_PATTERNS:
        if re.search(pattern, q):
            return "Tuyệt vời! 👍 Bạn cứ tiếp tục ôn bài nhé, mình luôn ở đây sẵn sàng hỗ trợ! 📚"

    return None


RAG_SYSTEM_PROMPT = """Bạn là Trợ lý Học thuật Đại học. Bạn CHỈ ĐƯỢC PHÉP trả lời dựa trên các đoạn ngữ cảnh [NGUỒN 1], [NGUỒN 2]... được cung cấp.

QUY TẮC BẮT BUỘC ĐỂ ĐẢM BẢO TÍNH HỌC THUẬT VÀ TRUNG THỰC:
1. CHỈ TRẢ LỜI TỪ NGỮ CẢNH ĐƯỢC CUNG CẤP: Tuyệt đối không tự suy diễn hoặc bổ sung kiến thức bên ngoài nếu tài liệu không đề cập.
2. BẮT BUỘC DẪN NGUỒN: Mỗi luận điểm, định nghĩa hoặc số liệu, bạn BẮT BUỘC phải ghi kèm số hiệu nguồn [1], [2]... ngay sau câu đó (ví dụ: "TCP là giao thức hướng kết nối [1].").
3. TRƯỜNG HỢP KHÔNG ĐỦ THÔNG TIN: Nếu ngữ cảnh không có thông tin hoặc không đủ tài liệu để trả lời, hãy trả lời chính xác:
   "Tài liệu hiện tại không có thông tin về vấn đề này. Bạn có thể mở rộng phạm vi tìm kiếm hoặc chọn tài liệu khác."
4. TRÁNH LẶP TỪ & LẶP Ý (CỰC KỲ QUAN TRỌNG): Tuyệt đối KHÔNG lặp lại định nghĩa, không nhắc lại cùng một câu mở đầu hay chép lại các tiêu đề mục trùng nhau giữa các đoạn nguồn. Hãy tổng hợp (synthesize) thành một bài phân tích liền mạch, súc tích, đi thẳng vào trọng tâm câu hỏi.
5. TRÌNH BÀY MẠCH LẠC: Trình bày rõ ràng bằng các tiêu đề in đậm và gạch đầu dòng súc tích. Tuyệt đối không tự bịa danh sách nguồn ở cuối câu trả lời."""


def is_direct_general_query(query: str) -> bool:
    """
    Nhận diện nhanh các câu hỏi toán học / tính toán cơ bản để bypass vector search,
    giúp trả lời ngay lập tức mà không cần nạp context tài liệu.
    """
    q = query.strip().lower()
    # Phép toán cơ bản ví dụ: 1+1, 1 + 1 = mấy, 2*3 = ?, 100/4...
    if re.search(r'^\s*(\-?\d+[\d\.\,]*)\s*[\+\-\*\/\^\%x]\s*(\-?\d+[\d\.\,]*)', q):
        return True
    if re.search(r'^(tính|giải)\s+[\d\.\,\s\+\-\*\/\^\%\(\)\=]+', q):
        return True
    return False


GENERAL_KNOWLEDGE_SYSTEM_PROMPT = """Bạn là StudyEdu — trợ lý học tập thông minh dành cho sinh viên đại học.
Người dùng đang hỏi một câu hỏi KHÔNG nằm trong tài liệu đã tải lên.
Hãy trả lời bằng kiến thức phổ thông của bạn một cách chính xác, mạch lạc và hữu ích.

QUY TẮC:
1. Trả lời trực tiếp, đi thẳng vào câu hỏi.
2. Trình bày rõ ràng bằng tiêu đề in đậm và gạch đầu dòng súc tích nếu câu trả lời dài.
3. Nếu là câu hỏi tính toán, cho kết quả chính xác kèm giải thích ngắn.
4. Nếu là câu hỏi viết code, cho code hoạt động ngay kèm chú thích.
5. KHÔNG bịa trích dẫn [1], [2]... vì đây không phải nguồn tài liệu.
6. Trả lời bằng tiếng Việt (trừ khi người dùng hỏi bằng tiếng Anh).
7. Cuối câu trả lời, KHÔNG cần nhắc nhở người dùng tải tài liệu hay dùng chức năng khác."""


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
        history: Optional[List[Dict[str, str]]] = None,
        preferred_model: Optional[str] = None
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

        # Nếu là câu hỏi toán học / tính toán cơ bản rõ ràng, trả lời ngay qua General Knowledge
        if is_direct_general_query(query):
            logger.info(f"[RAG] Phát hiện câu hỏi tính toán cơ bản → gọi trực tiếp General Knowledge cho: '{query}'")
            res = self.llm_service.generate(
                prompt=query,
                system_prompt=GENERAL_KNOWLEDGE_SYSTEM_PROMPT,
                max_tokens=1024,
                preferred_model=preferred_model
            )
            prefix = "💡 *Nội dung này không có trong tài liệu đã tải lên. StudyEdu trả lời dựa trên kiến thức phổ thông:*\n\n"
            return {
                "answer": prefix + res.get("text", ""),
                "sources": [],
                "raw_retrieved": [],
                "model_used": res.get("model_used", "Unknown"),
                "is_fallback": True,
                "latency_sec": res.get("latency_sec", 0),
                "success": res.get("success", False)
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
            # --- General Knowledge Fallback ---
            # Thay vì báo lỗi cụt lủn, cho LLM trả lời bằng kiến thức phổ thông
            logger.info(f"[RAG] Không tìm thấy tài liệu phù hợp → kích hoạt General Knowledge Fallback cho: '{query}'")
            use_history = history and is_follow_up_query(query)
            history_str = format_history_for_prompt(history) if use_history else ""
            if history_str:
                gk_prompt = f"{history_str}\n\n[CÂU HỎI]\n{query}\n\nHãy trả lời câu hỏi trên một cách chính xác và hữu ích:"
            else:
                gk_prompt = query

            res = self.llm_service.generate(
                prompt=gk_prompt,
                system_prompt=GENERAL_KNOWLEDGE_SYSTEM_PROMPT,
                max_tokens=1024,
                preferred_model=preferred_model
            )
            # Thêm chú thích nguồn gốc câu trả lời
            answer_text = res.get("text", "")
            prefix = "💡 *Nội dung này không có trong tài liệu đã tải lên. StudyEdu trả lời dựa trên kiến thức phổ thông:*\n\n"
            return {
                "answer": prefix + answer_text,
                "sources": [],
                "raw_retrieved": [],
                "model_used": res.get("model_used", "Unknown"),
                "is_fallback": True,
                "latency_sec": res.get("latency_sec", 0),
                "success": res.get("success", False)
            }

        context_str = self.format_context(retrieved)
        history_str = format_history_for_prompt(history) if history else ""
        
        prompt = f"""[TÀI LIỆU]
{context_str}

{history_str}

[CÂU HỎI]
{query}

Dựa vào các đoạn nguồn trên, hãy tổng hợp câu trả lời mạch lạc, súc tích, TUYỆT ĐỐI KHÔNG lặp lại câu từ hay định nghĩa, đi thẳng vào trọng tâm và ghi rõ số trích dẫn [1], [2]... ngay sau thông tin tương ứng:"""

        res = self.llm_service.generate(prompt=prompt, system_prompt=RAG_SYSTEM_PROMPT, max_tokens=1024, preferred_model=preferred_model)
        
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
        history: Optional[List[Dict[str, str]]] = None,
        preferred_model: Optional[str] = None
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

        # Nếu là câu hỏi toán học / tính toán cơ bản rõ ràng, stream trực tiếp qua General Knowledge
        if is_direct_general_query(query):
            logger.info(f"[RAG Stream] Phát hiện câu hỏi tính toán cơ bản → gọi trực tiếp General Knowledge cho: '{query}'")
            prefix = "💡 *Nội dung này không có trong tài liệu đã tải lên. StudyEdu trả lời dựa trên kiến thức phổ thông:*\n\n"
            yield {"type": "token", "token": prefix}
            for token in self.llm_service.generate_stream(
                prompt=query,
                system_prompt=GENERAL_KNOWLEDGE_SYSTEM_PROMPT,
                max_tokens=1024,
                preferred_model=preferred_model
            ):
                yield {"type": "token", "token": token}
            yield {"type": "meta", "sources": [], "model": self.llm_service.active_model, "is_fallback": True}
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
            # --- General Knowledge Fallback (Streaming) ---
            logger.info(f"[RAG Stream] Không tìm thấy tài liệu → kích hoạt General Knowledge Fallback cho: '{query}'")
            use_history = history and is_follow_up_query(query)
            history_str = format_history_for_prompt(history) if use_history else ""
            if history_str:
                gk_prompt = f"{history_str}\n\n[CÂU HỎI]\n{query}\n\nHãy trả lời câu hỏi trên một cách chính xác và hữu ích:"
            else:
                gk_prompt = query

            # Stream prefix chú thích trước
            prefix = "💡 *Nội dung này không có trong tài liệu đã tải lên. StudyEdu trả lời dựa trên kiến thức phổ thông:*\n\n"
            yield {"type": "token", "token": prefix}

            # Stream câu trả lời từ LLM
            for token in self.llm_service.generate_stream(
                prompt=gk_prompt,
                system_prompt=GENERAL_KNOWLEDGE_SYSTEM_PROMPT,
                max_tokens=1024,
                preferred_model=preferred_model
            ):
                yield {"type": "token", "token": token}

            yield {"type": "meta", "sources": [], "model": self.llm_service.active_model, "is_fallback": True}
            return

        context_str = self.format_context(retrieved)
        history_str = format_history_for_prompt(history) if history else ""
        
        prompt = f"""[TÀI LIỆU]
{context_str}

{history_str}

[CÂU HỎI]
{query}

Dựa vào các đoạn nguồn trên, hãy tổng hợp câu trả lời mạch lạc, súc tích, TUYỆT ĐỐI KHÔNG lặp lại câu từ hay định nghĩa, đi thẳng vào trọng tâm và ghi rõ số trích dẫn [1], [2]... ngay sau thông tin tương ứng:"""

        accumulated_text = ""
        for token in self.llm_service.generate_stream(prompt=prompt, system_prompt=RAG_SYSTEM_PROMPT, max_tokens=1024, preferred_model=preferred_model):
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
