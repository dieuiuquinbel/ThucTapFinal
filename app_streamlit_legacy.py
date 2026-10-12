import os
import time
import tempfile
import streamlit as st

# Cấu hình trang giao diện
st.set_page_config(
    page_title="Trợ lý Học tập Thông minh - RAG Local LLM",
    page_icon="🎓",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS cho giao diện trực quan và chuyên nghiệp
st.markdown("""
<style>
    .main-title {
        font-size: 2.2rem;
        font-weight: 700;
        color: #1E3A8A;
        margin-bottom: 0.2rem;
    }
    .sub-title {
        font-size: 1.05rem;
        color: #4B5563;
        margin-bottom: 1.5rem;
    }
    .citation-box {
        background-color: #F3F4F6;
        border-left: 4px solid #3B82F6;
        padding: 10px 14px;
        margin-top: 8px;
        border-radius: 4px;
        font-size: 0.9rem;
    }
    .badge-primary {
        background-color: #DBEAFE;
        color: #1E40AF;
        padding: 4px 8px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.8rem;
    }
    .badge-fallback {
        background-color: #FEF3C7;
        color: #92400E;
        padding: 4px 8px;
        border-radius: 12px;
        font-weight: 600;
        font-size: 0.8rem;
    }
    .quiz-card {
        background-color: #F9FAFB;
        border: 1px solid #E5E7EB;
        padding: 16px;
        border-radius: 8px;
        margin-bottom: 16px;
    }
</style>
""", unsafe_allow_html=True)

# Khởi tạo các module
from modules.document_loader import load_document
from modules.text_processor import chunk_document_pages
from modules.embedding_service import EmbeddingService
from modules.vector_store import VectorStore
from modules.llm_service import LLMService
from modules.rag_pipeline import RAGPipeline
from modules.quiz_generator import QuizGenerator
from modules.summarizer import DocumentSummarizer

@st.cache_resource
def init_services():
    embed_service = EmbeddingService(model_name="nomic-embed-text")
    vector_store = VectorStore(persist_dir="chroma_db", embedding_service=embed_service)
    llm_service = LLMService(
        primary_model="qwen2.5:7b",
        fallback_model="llama3.1:8b",
        alt_model="qwen2.5:3b"
    )
    rag_pipeline = RAGPipeline(vector_store=vector_store, llm_service=llm_service)
    quiz_gen = QuizGenerator(llm_service=llm_service)
    summarizer = DocumentSummarizer(llm_service=llm_service)
    return vector_store, llm_service, rag_pipeline, quiz_gen, summarizer

vector_store, llm_service, rag_pipeline, quiz_gen, summarizer = init_services()

# Quản lý session state
if "messages" not in st.session_state:
    st.session_state.messages = []
if "current_quiz" not in st.session_state:
    st.session_state.current_quiz = None
if "quiz_submitted" not in st.session_state:
    st.session_state.quiz_submitted = False
if "user_answers" not in st.session_state:
    st.session_state.user_answers = {}
if "flashcards" not in st.session_state:
    st.session_state.flashcards = None

# --- SIDEBAR: QUẢN LÝ TÀI LIỆU & HỆ THỐNG ---
with st.sidebar:
    st.title("⚙️ Cấu hình Hệ thống")
    
    # Hiển thị thông tin mô hình
    curr_model = llm_service.active_model
    is_fb = (curr_model != "qwen2.5:7b")
    
    st.markdown("### 🤖 Trạng thái AI")
    if not is_fb:
        st.markdown(f'<span class="badge-primary">Mô hình Chính: {curr_model}</span>', unsafe_allow_html=True)
    else:
        st.markdown(f'<span class="badge-fallback">Mô hình Dự phòng: {curr_model}</span>', unsafe_allow_html=True)
    st.caption("Embedding: `nomic-embed-text` | ChromaDB Cục bộ")
    
    st.divider()
    
    # Upload tài liệu
    st.markdown("### 📤 Tải lên tài liệu học tập")
    uploaded_files = st.file_uploader(
        "Hỗ trợ PDF, DOCX, TXT", 
        type=["pdf", "docx", "txt"], 
        accept_multiple_files=True
    )
    
    if uploaded_files:
        if st.button("🚀 Bắt đầu lập chỉ mục (Index)"):
            with st.status("Đang xử lý tài liệu...", expanded=True) as status:
                total_chunks_added = 0
                for up_file in uploaded_files:
                    st.write(f"Đang đọc: `{up_file.name}`...")
                    # Lưu file tạm để PyMuPDF đọc
                    suffix = os.path.splitext(up_file.name)[1]
                    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                        tmp.write(up_file.getvalue())
                        tmp_path = tmp.name
                    
                    try:
                        pages = load_document(tmp_path)
                        # Đổi lại source metadata thành tên tệp gốc
                        for p in pages:
                            p["metadata"]["source"] = up_file.name
                            p["metadata"]["file_path"] = up_file.name
                        
                        chunks = chunk_document_pages(pages, chunk_size=800, chunk_overlap=150)
                        added = vector_store.add_documents(chunks)
                        total_chunks_added += added
                        st.write(f"✅ `{up_file.name}`: {len(pages)} trang, tạo thành {added} đoạn vector.")
                    except Exception as ex:
                        st.error(f"Lỗi khi xử lý {up_file.name}: {ex}")
                    finally:
                        if os.path.exists(tmp_path):
                            os.remove(tmp_path)
                            
                status.update(label=f"Hoàn tất! Đã nạp {total_chunks_added} đoạn văn bản.", state="complete", expanded=False)
                st.success("Tài liệu đã sẵn sàng cho hỏi đáp và ôn tập!")
                st.rerun()

    st.divider()

    # Danh sách tài liệu hiện có trong Database
    st.markdown("### 📚 Tài liệu đã lưu trữ")
    docs_in_db = vector_store.list_documents()
    
    doc_options = ["Tất cả tài liệu"]
    if docs_in_db:
        for d in docs_in_db:
            doc_options.append(d["source"])
            col_d1, col_d2 = st.columns([3, 1])
            with col_d1:
                st.write(f"📄 **{d['source']}** ({d['chunks']} đoạn)")
            with col_d2:
                if st.button("🗑️", key=f"del_{d['source']}", help="Xóa tài liệu này"):
                    vector_store.delete_document(d["source"])
                    st.rerun()
    else:
        st.info("Chưa có tài liệu nào trong hệ thống.")

    # Bộ lọc tài liệu truy vấn
    st.divider()
    selected_doc_filter = st.selectbox(
        "🔍 Phạm vi tài liệu hỏi đáp:",
        options=doc_options,
        index=0
    )


# --- NỘI DUNG CHÍNH (MAIN AREA) ---
st.markdown('<div class="main-title">🎓 Trợ lý Quản lý Tài liệu & Ôn luyện Học tập Thông minh</div>', unsafe_allow_html=True)
st.markdown('<div class="sub-title">Ứng dụng kỹ thuật RAG (Retrieval-Augmented Generation) & Local LLM bảo mật, không cần Internet</div>', unsafe_allow_html=True)

tab_chat, tab_quiz, tab_flashcard, tab_summary, tab_arch = st.tabs([
    "💬 Hỏi đáp Tài liệu (Chatbot)",
    "📝 Luyện thi Trắc nghiệm (Quiz)",
    "🗂️ Flashcard Học nhanh",
    "📑 Tóm tắt Tài liệu",
    "📊 Kiến trúc & Thống kê"
])

# ================= TAB 1: HỎI ĐÁP RAG CHATBOT =================
with tab_chat:
    st.markdown("##### 💬 Đặt câu hỏi bằng ngôn ngữ tự nhiên dựa trên tài liệu đã tải")
    
    # Hiển thị lịch sử chat
    for msg in st.session_state.messages:
        with st.chat_message(msg["role"]):
            st.markdown(msg["content"])
            if "sources" in msg and msg["sources"]:
                with st.expander("📍 Trích dẫn nguồn tài liệu tham chiếu:"):
                    for s in msg["sources"]:
                        st.markdown(f"- **{s['source']}** (Trang {s['page']}) — *Độ khớp: {s['score']*100:.1f}%*")
                        st.caption(f"Trích đoạn: \"{s['snippet']}\"")
            if "latency" in msg:
                st.caption(f"⚡ Thời gian phản hồi: {msg['latency']}s | Model: `{msg['model_used']}`")

    # Input chat
    user_query = st.chat_input("Nhập câu hỏi cần tra cứu trong bài giảng / tài liệu...")
    if user_query:
        # Lưu câu hỏi người dùng
        st.session_state.messages.append({"role": "user", "content": user_query})
        with st.chat_message("user"):
            st.markdown(user_query)

        # Trả lời từ RAG Pipeline
        with st.chat_message("assistant"):
            with st.spinner("Đang tra cứu vector và tổng hợp câu trả lời từ tài liệu..."):
                response = rag_pipeline.answer_query(
                    query=user_query,
                    top_k=4,
                    filter_source=selected_doc_filter
                )
                
                answer_text = response["answer"]
                st.markdown(answer_text)
                
                if response["sources"]:
                    with st.expander("📍 Trích dẫn nguồn tài liệu tham chiếu:"):
                        for s in response["sources"]:
                            st.markdown(f"- **{s['source']}** (Trang {s['page']}) — *Độ khớp: {s['score']*100:.1f}%*")
                            st.caption(f"Trích đoạn: \"{s['snippet']}\"")
                
                st.caption(f"⚡ Thời gian phản hồi: {response['latency_sec']}s | Model: `{response['model_used']}`")
                
                # Lưu vào lịch sử
                st.session_state.messages.append({
                    "role": "assistant",
                    "content": answer_text,
                    "sources": response["sources"],
                    "latency": response["latency_sec"],
                    "model_used": response["model_used"]
                })


# ================= TAB 2: SINH CÂU HỎI TRẮC NGHIỆM =================
with tab_quiz:
    st.markdown("##### 📝 Tự động tạo bài trắc nghiệm ôn tập từ tài liệu học tập")
    
    col_q1, col_q2, col_q3 = st.columns([2, 1, 1])
    with col_q1:
        quiz_doc = st.selectbox("Chọn tài liệu làm đề ôn thi:", [d["source"] for d in docs_in_db] if docs_in_db else ["Chưa có tài liệu"])
    with col_q2:
        num_q = st.select_slider("Số lượng câu hỏi:", options=[3, 5, 10], value=5)
    with col_q3:
        diff = st.selectbox("Độ khó:", ["Cơ bản", "Trung bình", "Nâng cao"], index=1)

    if st.button("🎲 Sinh đề ôn thi ngay"):
        if not docs_in_db:
            st.warning("Vui lòng tải lên tài liệu PDF ở cột bên trái trước.")
        else:
            with st.spinner("AI đang phân tích tài liệu và biên soạn câu hỏi trắc nghiệm kèm giải thích..."):
                # Lấy mẫu các đoạn văn bản từ tài liệu
                chunks = vector_store.similarity_search(query="các khái niệm chính và kiến thức trọng tâm", top_k=6, filter_source=quiz_doc)
                combined_text = "\n\n".join([c["text"] for c in chunks])
                
                quiz_result = quiz_gen.generate_quiz(context_text=combined_text, num_questions=num_q, difficulty=diff)
                if quiz_result["success"] and isinstance(quiz_result["data"], list):
                    st.session_state.current_quiz = quiz_result["data"]
                    st.session_state.quiz_submitted = False
                    st.session_state.user_answers = {}
                    st.success(f"Đã tạo thành công {len(st.session_state.current_quiz)} câu trắc nghiệm!")
                else:
                    st.error("Không thể tạo trắc nghiệm. Vui lòng thử lại.")
                    st.caption(f"Chi tiết: {quiz_result.get('error') or quiz_result.get('raw')}")

    # Hiển thị bài thi trắc nghiệm
    if st.session_state.current_quiz:
        st.divider()
        st.subheader("📋 BÀI THI TRẮC NGHIỆM ÔN TẬP")
        
        for idx, q in enumerate(st.session_state.current_quiz):
            st.markdown(f"**Câu {idx + 1}: {q.get('question')}**")
            options = q.get("options", {})
            opt_list = [f"{k}. {v}" for k, v in options.items()]
            
            # Key lưu trạng thái radio
            choice = st.radio(
                f"Lựa chọn đáp án câu {idx + 1}:",
                options=opt_list,
                key=f"quiz_opt_{idx}",
                index=None,
                disabled=st.session_state.quiz_submitted,
                label_visibility="collapsed"
            )
            if choice:
                selected_key = choice.split(".")[0].strip()
                st.session_state.user_answers[idx] = selected_key
            
            # Nếu đã nộp bài thì hiển thị kết quả đúng sai và giải thích
            if st.session_state.quiz_submitted:
                user_choice = st.session_state.user_answers.get(idx)
                correct_ans = q.get("correct_answer")
                
                if user_choice == correct_ans:
                    st.success(f"✅ **Chính xác!** Đáp án đúng là **{correct_ans}**")
                else:
                    st.error(f"❌ **Chưa chính xác!** Bạn chọn: `{user_choice or 'Chưa chọn'}`, Đáp án đúng: **{correct_ans}**")
                
                st.info(f"💡 **Giải thích:** {q.get('explanation')}\n\n*Nguồn ghi nhớ: {q.get('source_note', '')}*")
            st.markdown("---")

        if not st.session_state.quiz_submitted:
            if st.button("📤 Nộp bài & Chấm điểm", type="primary"):
                st.session_state.quiz_submitted = True
                st.rerun()
        else:
            # Tính điểm
            correct_count = 0
            for idx, q in enumerate(st.session_state.current_quiz):
                if st.session_state.user_answers.get(idx) == q.get("correct_answer"):
                    correct_count += 1
            total = len(st.session_state.current_quiz)
            score_10 = round((correct_count / total) * 10, 1)
            
            st.balloons()
            st.markdown(f"### 🏆 KẾT QUẢ: `{correct_count}/{total}` câu đúng — Điểm số: `{score_10}/10`")
            if st.button("🔄 Làm lại bài trắc nghiệm"):
                st.session_state.quiz_submitted = False
                st.session_state.user_answers = {}
                st.rerun()


# ================= TAB 3: FLASHCARD HỌC NHANH =================
with tab_flashcard:
    st.markdown("##### 🗂️ Flashcard thuật ngữ và khái niệm trọng tâm ôn thi")
    
    col_fc1, col_fc2 = st.columns([3, 1])
    with col_fc1:
        fc_doc = st.selectbox("Chọn tài liệu sinh Flashcard:", [d["source"] for d in docs_in_db] if docs_in_db else ["Chưa có tài liệu"], key="fc_doc_select")
    with col_fc2:
        num_fc = st.select_slider("Số lượng thẻ:", options=[4, 6, 8], value=6)

    if st.button("🎴 Tạo bộ Flashcard"):
        if not docs_in_db:
            st.warning("Vui lòng tải lên tài liệu trước.")
        else:
            with st.spinner("Đang chiết xuất các khái niệm cốt lõi thành thẻ Flashcard..."):
                chunks = vector_store.similarity_search(query="định nghĩa và các thuật ngữ quan trọng", top_k=6, filter_source=fc_doc)
                combined_text = "\n\n".join([c["text"] for c in chunks])
                fc_res = quiz_gen.generate_flashcards(combined_text, num_cards=num_fc)
                if fc_res["success"] and isinstance(fc_res["data"], list):
                    st.session_state.flashcards = fc_res["data"]
                    st.success(f"Đã tạo thành công {len(st.session_state.flashcards)} thẻ Flashcard!")
                else:
                    st.error("Không thể tạo Flashcard. Vui lòng thử lại.")

    if st.session_state.flashcards:
        st.divider()
        cols = st.columns(2)
        for i, card in enumerate(st.session_state.flashcards):
            with cols[i % 2]:
                with st.container(border=True):
                    st.markdown(f"**🏷️ Thẻ #{i+1}: {card.get('front')}**")
                    st.caption(f"Chủ đề: {card.get('category', 'Khái niệm')}")
                    with st.expander("🔍 Lật thẻ xem định nghĩa & lời giải"):
                        st.markdown(card.get("back"))


# ================= TAB 4: TÓM TẮT TÀI LIỆU =================
with tab_summary:
    st.markdown("##### 📑 Tóm tắt nội dung giáo trình & Đề cương ôn tập nhanh")
    
    col_sm1, col_sm2 = st.columns([3, 1])
    with col_sm1:
        sum_doc = st.selectbox("Chọn tài liệu tóm tắt:", [d["source"] for d in docs_in_db] if docs_in_db else ["Chưa có tài liệu"], key="sum_doc_select")
    with col_sm2:
        style = st.selectbox("Kiểu tóm tắt:", ["Chuẩn học thuật", "Gạch đầu dòng ôn thi nhanh", "Súc tích"])

    if st.button("✨ Tiến hành Tóm tắt"):
        if not docs_in_db:
            st.warning("Vui lòng tải lên tài liệu trước.")
        else:
            with st.spinner("AI đang tổng hợp và chắt lọc nội dung tài liệu..."):
                chunks = vector_store.similarity_search(query="tổng quan toàn bộ bài giảng và các nội dung cốt lõi", top_k=8, filter_source=sum_doc)
                combined_text = "\n\n".join([c["text"] for c in chunks])
                
                sum_res = summarizer.summarize(text_content=combined_text, document_title=sum_doc, summary_style=style)
                if sum_res["success"]:
                    st.markdown("### 📋 BẢN TÓM TẮT HỌC TẬP")
                    st.markdown(sum_res["text"])
                    st.caption(f"⚡ Thời gian sinh: {sum_res['latency_sec']}s | Model: `{sum_res['model_used']}`")
                    st.download_button("📥 Tải bản tóm tắt (.txt)", data=sum_res["text"], file_name=f"TomTat_{sum_doc}.txt")
                else:
                    st.error("Không thể hoàn thành bản tóm tắt. Lỗi: " + sum_res["text"])


# ================= TAB 5: KIẾN TRÚC & THỐNG KÊ =================
with tab_arch:
    st.markdown("### 🏛️ Kiến trúc Hệ thống RAG Local LLM")
    st.code("""
      [Người dùng / Sinh viên]
                 │
                 ▼
      [GIAO DIỆN WEB (Streamlit)]
                 │
     ┌───────────┴───────────┐
     ▼                       ▼
 [Upload PDF / Slide]    [Khung Chat / Ôn tập]
     │                       │
     ▼                       ▼
 [Tách văn bản & Chunks]   [Truy vấn câu hỏi]
     │                       │
     ▼                       ▼
[Vector Database (ChromaDB)]◄┘ (Tìm đoạn văn bản liên quan nhất)
     │
     ▼ (Gộp Context tài liệu + Câu hỏi)
[LOCAL LLM (Ollama - Qwen 2.5 7B / Dự phòng: Llama 3.1 8B)]
     │
     ▼
 1. Trả lời câu hỏi (kèm trích dẫn trang tài liệu)
 2. Tự động sinh 5-10 câu trắc nghiệm (Flashcard / Quiz)
 3. Tóm tắt nội dung chính
    """, language="text")
    
    st.divider()
    st.markdown("### 💻 Cấu hình & Tài nguyên Thực tế")
    st.write(f"- **Mô hình Chính (Primary):** `qwen2.5:7b` (Chuyên biệt tiếng Việt & tư duy có cấu trúc)")
    st.write(f"- **Mô hình Dự phòng (Fallback):** `llama3.1:8b` (Tự động kích hoạt khi mô hình chính timeout/lỗi)")
    st.write(f"- **Embedding Model:** `nomic-embed-text` (Ollama - Context 8192 tokens)")
    st.write(f"- **Vector Store:** ChromaDB (Lưu trữ đĩa cứng `./chroma_db`)")
    st.write(f"- **Trích xuất PDF:** PyMuPDF (`fitz`) - Giữ nguyên chỉ số trang và siêu dữ liệu")
