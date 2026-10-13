import os
import json
import time
import logging
import tempfile
from typing import Optional, List
from dotenv import load_dotenv

# Tải cấu hình biến môi trường từ .env
load_dotenv()

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from modules.document_loader import load_document
from modules.text_processor import chunk_document_pages
from modules.embedding_service import EmbeddingService
from modules.vector_store import VectorStore
from modules.llm_service import LLMService
from modules.rag_pipeline import RAGPipeline
from modules.quiz_generator import QuizGenerator
from modules.summarizer import DocumentSummarizer
from modules.auth_service import AuthService, decode_jwt_token

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI(
    title="RAG Learning Assistant API",
    description="Backend API cho Hệ thống Quản lý tài liệu và ôn luyện học tập thông minh",
    version="1.0.0"
)

# Cho phép React frontend kết nối
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo singleton services với mô hình đa ngôn ngữ bge-m3
embed_service = EmbeddingService(model_name="bge-m3")
vector_store = VectorStore(persist_dir="chroma_db", embedding_service=embed_service)
llm_service = LLMService(
    primary_model="qwen2.5:7b",
    fallback_model="qwen2.5:3b"
)
rag_pipeline = RAGPipeline(vector_store=vector_store, llm_service=llm_service)
quiz_gen = QuizGenerator(llm_service=llm_service)
summarizer = DocumentSummarizer(llm_service=llm_service)


# Pydantic Schemas
class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    filter_source: Optional[str] = "Tất cả tài liệu"
    top_k: Optional[int] = Field(default=4, ge=1, le=10)
    history: Optional[List[ChatMessage]] = None
    model_mode: Optional[str] = "deep"  # "fast" (qwen2.5:3b) | "deep" (qwen2.5:7b)


class QuizRequest(BaseModel):
    document_source: str
    num_questions: Optional[int] = Field(default=5, ge=1, le=25)
    difficulty: Optional[str] = "Trung bình"
    shuffle: Optional[bool] = False


class FlashcardRequest(BaseModel):
    document_source: str
    num_cards: Optional[int] = Field(default=6, ge=1, le=15)


class SummarizeRequest(BaseModel):
    document_source: str
    style: Optional[str] = "Trung bình"


class RegisterRequest(BaseModel):
    email: str
    full_name: str
    password: str
    avatar: Optional[str] = "🐱"

class VerifyOtpRequest(BaseModel):
    email: str
    otp: str

class LoginRequest(BaseModel):
    email: str
    password: str

class ResendOtpRequest(BaseModel):
    email: str
    type: Optional[str] = "verify-email"

class SaveQuizScoreRequest(BaseModel):
    document_source: str
    score_10: float
    correct_count: int
    total_questions: int
    difficulty: str


@app.get("/api/status")
def get_system_status():
    """
    Kiểm tra trạng thái THỰC TẾ (Live Health Check):
    - Ping Ollama server
    - Xác định danh sách model đã cài đặt
    - Đánh giá trạng thái online/degraded/offline
    """
    ollama_online = False
    installed_models = []
    try:
        res = llm_service.client.list()
        ollama_online = True
        installed_models = [
            (m.get("name") or m.get("model", "")).split(":")[0] 
            for m in res.get("models", [])
        ]
    except Exception:
        ollama_online = False

    curr_model = llm_service.active_model
    is_fallback = (curr_model != "qwen2.5:7b")
    docs = vector_store.list_documents()
    total_chunks = sum(d["chunks"] for d in docs)
    
    # Xác định status thực tế
    if not ollama_online:
        system_status = "offline"
    elif "qwen2.5" not in installed_models:
        system_status = "no_models"
    elif is_fallback:
        system_status = "degraded"
    else:
        system_status = "online"

    return {
        "status": system_status,
        "ollama_online": ollama_online,
        "active_model": curr_model,
        "is_fallback": is_fallback,
        "primary_model": "qwen2.5:7b",
        "fallback_model": "qwen2.5:3b",
        "embedding_model": "bge-m3",
        "installed_models": installed_models,
        "total_documents": len(docs),
        "total_chunks": total_chunks
    }


@app.get("/api/documents")
def list_documents():
    """
    Lấy danh sách các tài liệu đã được index trong Vector Store.
    """
    return vector_store.list_documents()





ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt", ".md"}
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB

def precompute_study_assets(filename: str):
    """
    Tiến trình chạy ngầm siêu tốc bằng Qwen 2.5 3B (~10-15s):
    Chuẩn bị sẵn Tóm tắt & Quiz vào Cache bằng model 3B để:
    1. Hoàn tất cực nhanh (10-15s thay vì 2 phút).
    2. Dùng chung model 3B với Chat, không gây nghẽn hàng đợi hay tráo đổi VRAM trên GPU 6GB.
    """
    import time
    time.sleep(1.0)  # Để response upload trả về ngay lập tức cho client
    try:
        chunks = vector_store.get_document_chunks_sampled(source_filename=filename, max_chunks=5)
        if not chunks:
            return
        combined_text = "\n\n".join([f"(Trang {c.get('page', 1)}): {c['text']}" for c in chunks])
        
        # 1. Tóm tắt 'Trung bình' trước bằng 3B siêu tốc (~4s)
        logger.info(f"[Background] Đang tạo cache Tóm tắt 'Trung bình' (3B siêu tốc) cho {filename}...")
        summarizer.summarize(
            text_content=combined_text[:3500], 
            document_title=filename, 
            summary_style="Trung bình",
            preferred_model="qwen2.5:3b"
        )
        
        # 2. Sinh sẵn Đề thi trắc nghiệm Quiz 5 câu 'Trung bình' bằng 3B (~8s)
        logger.info(f"[Background] Đang tạo cache Quiz 'Trung bình' 5 câu (3B siêu tốc) cho {filename}...")
        quiz_gen.generate_quiz(
            context_text=combined_text[:3500], 
            num_questions=5, 
            difficulty="Trung bình", 
            doc_name=filename,
            preferred_model="qwen2.5:3b"
        )
        
        logger.info(f"[Background] HOÀN TẤT nạp cache khởi động nhanh cho {filename}!")
    except Exception as e:
        logger.warning(f"[Background Precompute] Không thể tạo cache trước cho {filename}: {e}")


@app.post("/api/precompute/{filename}")
def trigger_precompute(filename: str, background_tasks: BackgroundTasks):
    """
    Tiến trình nạp ngầm thông minh khi học viên rảnh tay đọc câu trả lời chat:
    Chỉ nạp ngầm nếu tài liệu chưa có sẵn bộ nhớ đệm Cache.
    """
    cached_sum = summarizer.get_cached_summary(filename, "Trung bình")
    cached_quiz = quiz_gen.get_cached_quiz(filename, "Trung bình")
    if cached_sum and cached_quiz:
        return {"status": "already_cached", "message": "Tài liệu đã có sẵn cache"}
    
    background_tasks.add_task(precompute_study_assets, filename)
    return {"status": "scheduled", "message": f"Đang chuẩn bị ngầm đề thi và tóm tắt cho {filename}"}


@app.post("/api/upload")
async def upload_documents(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...)):
    """
    Tải lên và xử lý phân tích file PDF, DOCX, TXT vào ChromaDB có kiểm soát định dạng & kích thước.
    """
    results = []
    total_chunks = 0
    
    for file in files:
        suffix = os.path.splitext(file.filename)[1].lower()
        if suffix == ".doc":
            results.append({
                "filename": file.filename,
                "error": "Định dạng .doc cũ (Word 97-2003) không được hỗ trợ. Vui lòng mở tệp bằng Word và Lưu dưới dạng (Save As) sang .docx hoặc .pdf trước khi tải lên.",
                "status": "error"
            })
            continue

        if suffix not in ALLOWED_EXTENSIONS:
            results.append({
                "filename": file.filename,
                "error": f"Định dạng tệp '{suffix}' không được hỗ trợ. Chỉ chấp nhận .pdf, .docx, .txt.",
                "status": "error"
            })
            continue

        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            results.append({
                "filename": file.filename,
                "error": f"Kích thước tệp ({len(content)/(1024*1024):.1f}MB) vượt quá giới hạn tối đa 50MB.",
                "status": "error"
            })
            continue

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            t0 = time.time()
            pages = load_document(tmp_path)
            t1 = time.time()
            logger.info(f"[Upload] Trích xuất {file.filename}: {len(pages)} trang trong {t1-t0:.1f}s")
            
            for p in pages:
                p["metadata"]["source"] = file.filename
            # Xóa các chunk cũ và toàn bộ cache cũ (tóm tắt & quiz) của file
            vector_store.delete_document(file.filename)
            summarizer.delete_cache(file.filename)
            quiz_gen.delete_cache(file.filename)

            chunks = chunk_document_pages(pages, chunk_size=800, chunk_overlap=150)
            t2 = time.time()
            logger.info(f"[Upload] Chunking {file.filename}: {len(chunks)} chunks trong {t2-t1:.1f}s")
            
            added = vector_store.add_documents(chunks)
            t3 = time.time()
            logger.info(f"[Upload] Embedding + ChromaDB {file.filename}: {added} chunks trong {t3-t2:.1f}s")
            logger.info(f"[Upload] === TỔNG {file.filename}: {t3-t0:.1f}s ===")
            
            total_chunks += added
            
            # Ưu tiên GPU 100% cho Demo Chat ngay sau khi tải file xong:
            # Không tự ý chạy nền chiếm dụng GPU. Khi nào người dùng bấm sang Quiz / Tóm tắt mới sinh theo yêu cầu (On-Demand).

            results.append({
                "filename": file.filename,
                "pages": len(pages),
                "chunks": added,
                "status": "success"
            })
        except Exception as e:
            results.append({
                "filename": file.filename,
                "error": str(e),
                "status": "error"
            })
        finally:
            if os.path.exists(tmp_path):
                os.remove(tmp_path)

    successful_count = sum(1 for r in results if r["status"] == "success")
    if successful_count == 0 and len(files) > 0:
        first_err = results[0].get("error", "Xử lý tệp thất bại")
        raise HTTPException(status_code=400, detail=first_err)

    return {
        "message": f"Đã xử lý xong {len(files)} tệp tin",
        "total_chunks_indexed": total_chunks,
        "details": results
    }


@app.delete("/api/documents/{filename}")
def delete_document(filename: str):
    """
    Xóa toàn bộ vector, bộ nhớ cache tóm tắt và bộ nhớ cache đề thi của tài liệu.
    """
    success = vector_store.delete_document(filename)
    summarizer.delete_cache(filename)
    quiz_gen.delete_cache(filename)
    if not success:
        raise HTTPException(status_code=400, detail="Không thể xóa tài liệu")
    return {"message": f"Đã xóa tài liệu và toàn bộ bộ nhớ đệm của {filename} thành công"}


@app.post("/api/chat")
def chat_with_documents(req: ChatRequest):
    """
    Gửi câu hỏi và nhận câu trả lời có trích dẫn nguồn (RAG).
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống")

    target_model = "qwen2.5:3b" if req.model_mode == "fast" else "qwen2.5:7b"
    resp = rag_pipeline.answer_query(
        query=req.query,
        top_k=req.top_k or 5,
        filter_source=req.filter_source,
        history=[m.model_dump() for m in req.history] if req.history else None,
        preferred_model=target_model
    )
    return resp


@app.post("/api/chat/stream")
def chat_with_documents_stream(req: ChatRequest):
    """
    Streaming trả lời RAG qua Server-Sent Events (SSE) để hiển thị phản hồi tức thì.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống")

    target_model = "qwen2.5:3b" if req.model_mode == "fast" else "qwen2.5:7b"
    def event_generator():
        for event in rag_pipeline.answer_query_stream(
            query=req.query,
            top_k=req.top_k or 5,
            filter_source=req.filter_source,
            history=[m.model_dump() for m in req.history] if req.history else None,
            preferred_model=target_model
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@app.post("/api/quiz")
def generate_quiz(req: QuizRequest):
    """
    Tự động sinh bộ câu hỏi trắc nghiệm A-B-C-D kèm giải thích.
    Sử dụng mẫu chunk trải đều toàn tài liệu để đảm bảo độ bao quát các chương.
    """
    chunks = vector_store.get_document_chunks_sampled(
        source_filename=req.document_source,
        max_chunks=6
    )
    if not chunks:
        raise HTTPException(status_code=404, detail="Không tìm thấy nội dung trong tài liệu được chọn")

    # Giữ trọn vẹn ngữ cảnh của các chunk lấy mẫu (tối đa 10.000 ký tự)
    combined_text = "\n\n".join([f"(Trang {c.get('page', 1)}): {c['text']}" for c in chunks])[:10000]
    res = quiz_gen.generate_quiz(
        context_text=combined_text,
        num_questions=min(max(req.num_questions or 5, 1), 25),
        difficulty=req.difficulty or "Trung bình",
        doc_name=req.document_source,
        shuffle=bool(req.shuffle)
    )
    return res


@app.post("/api/flashcards")
def generate_flashcards(req: FlashcardRequest):
    """
    Tự động sinh bộ thẻ ghi nhớ Flashcard.
    Sử dụng mẫu chunk trải đều toàn tài liệu.
    """
    chunks = vector_store.get_document_chunks_sampled(
        source_filename=req.document_source,
        max_chunks=6
    )
    if not chunks:
        raise HTTPException(status_code=404, detail="Không tìm thấy nội dung trong tài liệu được chọn")

    # Giữ trọn vẹn ngữ cảnh của các chunk lấy mẫu (tối đa 10.000 ký tự)
    combined_text = "\n\n".join([f"(Trang {c.get('page', 1)}): {c['text']}" for c in chunks])[:10000]
    res = quiz_gen.generate_flashcards(
        context_text=combined_text,
        num_cards=min(max(req.num_cards or 6, 2), 12)
    )
    return res


@app.post("/api/summarize")
def summarize_document(req: SummarizeRequest):
    """
    Tóm tắt bài giảng / tài liệu với độ bao quát toàn bộ tài liệu (từ trang đầu đến trang cuối).
    """
    chunks = vector_store.get_document_chunks_sampled(
        source_filename=req.document_source,
        max_chunks=8
    )
    if not chunks:
        raise HTTPException(status_code=404, detail="Không tìm thấy nội dung trong tài liệu được chọn")

    # Giữ trọn vẹn ngữ cảnh bao quát toàn tài liệu (tối đa 15.000 ký tự)
    combined_text = "\n\n".join([f"(Trang {c.get('page', 1)}): {c['text']}" for c in chunks])[:15000]
    res = summarizer.summarize(
        text_content=combined_text,
        document_title=req.document_source,
        summary_style=req.style or "Chuẩn học thuật"
    )
    return res


# ==========================================
# CÁC API XÁC THỰC VÀ LỊCH SỬ ĐIỂM HỌC VIÊN
# ==========================================

from fastapi import Header, Depends

def get_current_user(authorization: Optional[str] = Header(default=None)) -> Optional[dict]:
    logger.info(f"[Auth] get_current_user Header: {authorization}")
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    user = decode_jwt_token(token)
    logger.info(f"[Auth] Decoded user: {user}")
    return user

@app.post("/api/auth/register")
def register_user(req: RegisterRequest):
    try:
        res = AuthService.register(
            email=req.email,
            full_name=req.full_name,
            password=req.password,
            avatar=req.avatar or "🐱"
        )
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Lỗi đăng ký: {e}")
        raise HTTPException(status_code=500, detail="Không thể tạo tài khoản. Vui lòng thử lại!")

@app.post("/api/auth/verify-otp")
def verify_otp(req: VerifyOtpRequest):
    try:
        res = AuthService.verify_email_otp(email=req.email, otp_code=req.otp)
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Lỗi xác minh OTP: {e}")
        raise HTTPException(status_code=500, detail="Lỗi máy chủ khi xác thực OTP.")

@app.post("/api/auth/login")
def login_user(req: LoginRequest):
    try:
        res = AuthService.login(email=req.email, password=req.password)
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))
    except Exception as e:
        logger.error(f"Lỗi đăng nhập: {e}")
        raise HTTPException(status_code=500, detail="Không thể đăng nhập. Vui lòng thử lại!")

@app.post("/api/auth/resend-otp")
def resend_otp(req: ResendOtpRequest):
    try:
        res = AuthService.resend_otp(email=req.email, otp_type=req.type or "verify-email")
        return {"success": True, "data": res}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/auth/me")
def get_me(user: Optional[dict] = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Chưa đăng nhập hoặc token hết hạn")
    return {"success": True, "data": user}

@app.post("/api/user/quiz-score")
def save_quiz_score(req: SaveQuizScoreRequest, user: Optional[dict] = Depends(get_current_user)):
    if not user:
        return {"success": False, "message": "Guest quiz, not saved"}
    
    AuthService.save_quiz_score(
        user_id=int(user["sub"]),
        document_source=req.document_source,
        score_10=req.score_10,
        correct_count=req.correct_count,
        total_questions=req.total_questions,
        difficulty=req.difficulty
    )
    return {"success": True, "message": "Đã lưu điểm bài thi thành công"}

@app.get("/api/user/quiz-history")
def get_user_quiz_history(user: Optional[dict] = Depends(get_current_user)):
    if not user:
        return {"success": True, "data": []}
    
    history = AuthService.get_user_quiz_history(user_id=int(user["sub"]))
    return {"success": True, "data": history}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
