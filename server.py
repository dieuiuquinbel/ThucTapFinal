import os
import json
import time
import logging
import tempfile
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from modules.document_loader import load_document
from modules.text_processor import chunk_document_pages
from modules.embedding_service import EmbeddingService
from modules.vector_store import VectorStore
from modules.llm_service import LLMService
from modules.rag_pipeline import RAGPipeline
from modules.quiz_generator import QuizGenerator
from modules.summarizer import DocumentSummarizer

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
    fallback_model="llama3.1:8b"
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
    top_k: Optional[int] = 4
    history: Optional[List[ChatMessage]] = None


class QuizRequest(BaseModel):
    document_source: str
    num_questions: Optional[int] = 5
    difficulty: Optional[str] = "Trung bình"


class FlashcardRequest(BaseModel):
    document_source: str
    num_cards: Optional[int] = 6


class SummarizeRequest(BaseModel):
    document_source: str
    style: Optional[str] = "Chuẩn học thuật"


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
    elif "qwen2.5" not in installed_models and "llama3.1" not in installed_models:
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
        "fallback_model": "llama3.1:8b",
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





def precompute_study_assets(filename: str):
    """
    Tiến trình chạy ngầm (Background Task - NotebookLM Style):
    Tự động tóm tắt trước cả 3 mức (Cơ bản, Trung bình, Nâng cao) VÀ
    tự động sinh bộ đề thi trắc nghiệm (Trung bình, Dễ, Khó) vào Cache.
    """
    try:
        chunks = vector_store.get_document_chunks_sampled(source_filename=filename, max_chunks=8)
        if not chunks:
            return
        combined_text = "\n\n".join([f"(Trang {c.get('page', 1)}): {c['text']}" for c in chunks])
        
        # Tiến trình ngầm chỉ tạo sẵn 2 tài sản mặc định phổ biến nhất để GPU hoàn tất nhanh (~40s),
        # tránh gây tắc nghẽn hàng đợi khi người dùng bấm sinh đề hoặc tóm tắt.
        
        # 1. Tóm tắt 'Trung bình' (mặc định khi vào tab Tóm tắt)
        logger.info(f"[Background] Đang tạo cache Tóm tắt 'Trung bình' cho {filename}...")
        summarizer.summarize(text_content=combined_text, document_title=filename, summary_style="Trung bình")
        
        # 2. Sinh sẵn Đề thi trắc nghiệm Quiz 5 câu 'Trung bình' (mặc định khi vào tab Đề thi)
        quiz_context = combined_text[:8000]
        logger.info(f"[Background] Đang tạo cache Quiz 'Trung bình' (5 câu) cho {filename}...")
        quiz_gen.generate_quiz(context_text=quiz_context, num_questions=5, difficulty="Trung bình", doc_name=filename)
        
        logger.info(f"[Background] HOÀN TẤT nạp cache khởi động nhanh cho {filename}!")
    except Exception as e:
        logger.warning(f"[Background Precompute] Không thể tạo cache trước cho {filename}: {e}")


@app.post("/api/upload")
async def upload_documents(background_tasks: BackgroundTasks, files: List[UploadFile] = File(...)):
    """
    Tải lên và xử lý phân tích file PDF, DOCX, TXT vào ChromaDB.
    """
    results = []
    total_chunks = 0
    
    for file in files:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            content = await file.read()
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

            chunks = chunk_document_pages(pages, chunk_size=1200, chunk_overlap=200)
            t2 = time.time()
            logger.info(f"[Upload] Chunking {file.filename}: {len(chunks)} chunks trong {t2-t1:.1f}s")
            
            added = vector_store.add_documents(chunks)
            t3 = time.time()
            logger.info(f"[Upload] Embedding + ChromaDB {file.filename}: {added} chunks trong {t3-t2:.1f}s")
            logger.info(f"[Upload] === TỔNG {file.filename}: {t3-t0:.1f}s ===")
            
            total_chunks += added
            
            # Kích hoạt chạy ngầm tạo trước bản tóm tắt và bộ quiz vào Cache
            background_tasks.add_task(precompute_study_assets, file.filename)

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

    resp = rag_pipeline.answer_query(
        query=req.query,
        top_k=req.top_k or 5,
        filter_source=req.filter_source,
        history=[m.model_dump() for m in req.history] if req.history else None
    )
    return resp


@app.post("/api/chat/stream")
def chat_with_documents_stream(req: ChatRequest):
    """
    Streaming trả lời RAG qua Server-Sent Events (SSE) để hiển thị phản hồi tức thì.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Câu hỏi không được để trống")

    def event_generator():
        for event in rag_pipeline.answer_query_stream(
            query=req.query,
            top_k=req.top_k or 5,
            filter_source=req.filter_source,
            history=[m.model_dump() for m in req.history] if req.history else None
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
        num_questions=min(req.num_questions or 10, 15),
        difficulty=req.difficulty or "Trung bình",
        doc_name=req.document_source
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
        num_cards=min(req.num_cards or 6, 6)
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
