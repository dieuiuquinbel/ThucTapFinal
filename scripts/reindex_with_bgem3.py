import os
import sys
import glob
import unicodedata

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

from modules.document_loader import load_document
from modules.text_processor import chunk_document_pages
from modules.embedding_service import EmbeddingService
from modules.vector_store import VectorStore

def reindex_all():
    print("=================================================================")
    print("  TÁI KHỞI TẠO TOÀN BỘ CHROMA DB VỚI BGE-M3 (1024-DIM)")
    print("=================================================================")

    # 1. Khởi tạo dịch vụ BGE-M3
    bge_service = EmbeddingService(model_name="bge-m3")
    vs = VectorStore(embedding_service=bge_service)

    # 2. Xóa sạch dữ liệu Nomic cũ
    print("[1/3] Đang xóa sạch collection cũ...")
    vs.clear_all()
    print("      -> Đã xóa sạch collection study_documents.")

    # 3. Quét tất cả file PDF trong data/uploads và data/samples
    pdf_files = glob.glob("data/uploads/*.pdf") + glob.glob("data/samples/*.pdf")
    if not pdf_files:
        print("Không tìm thấy file PDF nào trong data/uploads hoặc data/samples!")
        return

    total_chunks = 0
    for pdf_path in pdf_files:
        filename = os.path.basename(pdf_path)
        print(f"\n[2/3] Đang nạp tài liệu gốc: {filename}")
        
        pages = load_document(pdf_path)
        print(f"      -> Trích xuất được {len(pages)} trang.")
        
        for p in pages:
            p["metadata"]["source"] = filename
            p["metadata"]["file_path"] = pdf_path

        # Băm nhỏ theo kích thước 1200 ký tự / overlap 200 ký tự
        chunks = chunk_document_pages(pages, chunk_size=1200, chunk_overlap=200)
        print(f"      -> Tạo được {len(chunks)} chunks cấu trúc (size=1200, overlap=200).")

        # Nhúng vector bằng BGE-M3
        print(f"      -> Đang tính toán vector nhúng BGE-M3 và lưu vào ChromaDB...")
        added = vs.add_documents(chunks)
        total_chunks += added
        print(f"      -> Hoàn tất thêm {added} chunks vào Vector DB.")

    print("\n=================================================================")
    print(f"  HOÀN THÀNH TÁI CHỈ MỤC: {total_chunks} chunks mới với BGE-M3")
    print("=================================================================")

if __name__ == "__main__":
    reindex_all()
