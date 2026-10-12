# SmartStudy RAG — Hệ thống quản lý tài liệu và ôn luyện học tập thông minh

SmartStudy RAG là ứng dụng web giúp sinh viên học từ tài liệu của mình. Người dùng tải PDF, DOCX hoặc TXT; hệ thống đọc tài liệu, tìm đoạn liên quan rồi dùng AI trả lời câu hỏi, tạo quiz, flashcard và tóm tắt.

Hệ thống áp dụng **RAG (Retrieval-Augmented Generation — sinh câu trả lời có truy xuất tài liệu)**. Nghĩa là trước khi AI trả lời, chương trình tìm các đoạn phù hợp trong tài liệu đã tải lên và gửi chúng làm căn cứ cho AI.

## 1. Chức năng chính

- Tải, xem danh sách và xóa tài liệu PDF, DOCX, TXT.
- Đọc text layer PDF; OCR ảnh, sơ đồ và PDF scan khi cần.
- Hỏi đáp theo tài liệu, kèm tên tệp và số trang nguồn.
- Hỗ trợ một số câu hỏi tiếp nối dựa trên lịch sử chat gần.
- Sinh trắc nghiệm A–B–C–D, chấm điểm và giải thích đáp án.
- Sinh flashcard từ thuật ngữ/định nghĩa quan trọng.
- Tóm tắt ba mức: Cơ bản, Trung bình, Nâng cao.
- Cache tóm tắt đã tạo để dùng lại nhanh hơn.
- Streaming câu trả lời từng phần ra giao diện.
- Tự dùng model dự phòng nếu model chính lỗi.

## 2. Kiến trúc hệ thống

```text
Người dùng
    │
    ▼
React + Vite + Tailwind CSS (giao diện web)
    │ REST API / SSE
    ▼
FastAPI Backend (điều phối xử lý)
    ├── Xử lý tài liệu / Document Processing
    │   ├── PyMuPDF: đọc PDF và lấy text layer
    │   ├── python-docx: đọc DOCX và bảng dữ liệu
    │   ├── EasyOCR: nhận diện chữ từ ảnh, sơ đồ, PDF scan
    │   └── Structure-aware chunking: chia tài liệu thành đoạn nhỏ
    │
    ├── Vector Retrieval (tìm đoạn tài liệu liên quan)
    │   ├── BGE-M3 qua Ollama: biến chữ thành vector ngữ nghĩa
    │   ├── ChromaDB: lưu vector, nội dung và số trang
    │   └── Hybrid reranking: sắp xếp lại đoạn phù hợp nhất
    │
    └── Sinh nội dung / Content Generation
        ├── Qwen 2.5 7B: model chính
        ├── Llama 3.1 8B: model dự phòng (fallback)
        └── SSE streaming: gửi câu trả lời dần về giao diện
```

## 3. Giải thích chi tiết các khối xử lý

### 3.1. Xử lý tài liệu — Document Processing

Mục tiêu là chuyển file thô thành văn bản sạch, có tên tệp và số trang để có thể tìm kiếm.

| Công nghệ | Dùng để làm gì | Tác dụng |
|---|---|---|
| **PyMuPDF (fitz)** | Đọc PDF | Lấy text layer theo từng trang; nhanh và chính xác với PDF có chữ thật. |
| **EasyOCR** | OCR (Optical Character Recognition — nhận diện ký tự quang học) | Đọc chữ nằm trong ảnh, sơ đồ hoặc PDF scan. OCR chạy CPU để nhường VRAM cho Qwen. |
| **python-docx** | Đọc Word DOCX | Lấy paragraph, page break và dữ liệu bảng. |
| **LangChain Text Splitter** | Chia văn bản | Cắt tài liệu dài thành các chunk để tìm kiếm và đưa vào context AI. |

Luồng PDF: PyMuPDF đọc text trước. Nếu trang ít text, chương trình OCR ảnh/sơ đồ lớn. Nếu trang là scan gần như hoàn toàn, trang được render thành ảnh và OCR toàn trang. Sau đó hệ thống chuẩn hóa Unicode tiếng Việt, loại header/footer lặp, rồi chia thành chunk khoảng **1.200 ký tự** với **overlap 200 ký tự**. Overlap giúp ý nằm ở ranh giới hai đoạn không bị mất.

Mã: `modules/document_loader.py`, `modules/text_processor.py`.

### 3.2. Vector Retrieval — Tìm kiếm theo ý nghĩa

Vector Retrieval trả lời câu hỏi: “Trong toàn bộ tài liệu, đoạn nào là bằng chứng phù hợp nhất cho câu hỏi hiện tại?”.

**BGE-M3** là **embedding model (mô hình nhúng)**, không phải model trả lời. Nó biến một câu hoặc đoạn văn thành một vector 1.024 chiều. Những câu có nghĩa gần nhau sẽ có vector gần nhau, kể cả khi cách dùng từ không giống hệt nhau.

Ví dụ, câu “Vai trò của thực tiễn đối với nhận thức?” có thể tìm được đoạn “thực tiễn là cơ sở, động lực và tiêu chuẩn của nhận thức”, dù hai câu không trùng nguyên văn.

**ChromaDB** là **vector database (cơ sở dữ liệu vector)**. Nó lưu nội dung chunk, vector BGE-M3, tên file, số trang và metadata. Khi có câu hỏi, ChromaDB so sánh vector câu hỏi với vector các chunk để lấy những đoạn có ý nghĩa gần nhất.

Sau đó **Hybrid Reranking (xếp hạng lại kết hợp)** dùng thêm độ khớp từ khóa và các tín hiệu như “định nghĩa”, “vai trò”, “chức năng”, “liệt kê” để đưa đoạn phù hợp nhất lên đầu. Frontend hiện gửi tối đa bốn chunk tốt nhất (`top_k=4`) làm context cho chat.

Mã: `modules/embedding_service.py`, `modules/vector_store.py`.

### 3.3. Sinh nội dung — Content Generation

Sau khi retrieval lấy được nguồn, backend ghép nguồn, lịch sử hội thoại gần và câu hỏi thành prompt gửi đến Ollama.

- **Qwen 2.5 7B** là model chính. Nó tạo câu trả lời tiếng Việt, tóm tắt, quiz hoặc flashcard dựa trên các đoạn nguồn đã nhận.
- **Llama 3.1 8B** là model dự phòng.
- **Failover (chuyển đổi dự phòng):** chương trình gọi Qwen trước. Nếu Qwen không kết nối được, timeout hoặc lỗi trước khi phản hồi, chương trình tự gửi cùng yêu cầu sang Llama. Người dùng không phải tự đổi model.
- **SSE Streaming (Server-Sent Events):** server gửi token/đoạn văn dần về trình duyệt, nên người dùng thấy câu trả lời xuất hiện dần thay vì chờ toàn bộ.

Chat dùng context tối đa 8.192 tokens. Context gồm prompt, các nguồn đã retrieval, lịch sử chat ngắn và câu trả lời đang sinh.

Mã: `modules/llm_service.py`, `modules/rag_pipeline.py`, `modules/quiz_generator.py`, `modules/summarizer.py`.

## 4. Cài đặt

### Yêu cầu

- Windows 10/11; Python 3.10+; Node.js 20+; Ollama.
- Khuyến nghị RAM 16 GB và GPU NVIDIA.
- RTX 4050 Laptop 6 GB phù hợp với Qwen 2.5 7B. Không khuyến nghị Qwen 14B làm model mặc định trên cấu hình này.

### Cài Python packages

```powershell
.\venv\Scripts\activate
pip install -r requirements.txt
```

### Cài frontend packages

```powershell
cd frontend
npm install
cd ..
```

### Tải model Ollama

```powershell
ollama pull qwen2.5:7b
ollama pull llama3.1:8b
ollama pull bge-m3
```

## 5. Khởi chạy

### Cách nhanh

```powershell
.\start_all.bat
```

Mở `http://127.0.0.1:3000`.

### Chạy thủ công

Terminal 1:

```powershell
ollama serve
```

Terminal 2:

```powershell
.\venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8080 --reload
```

Terminal 3:

```powershell
cd frontend
npm run dev -- --host 127.0.0.1 --port 3000
```

## 6. Kiểm thử

```powershell
.\venv\Scripts\python.exe scripts\run_benchmark_15.py
```

Bộ benchmark có 15 câu hỏi độc lập và follow-up để kiểm tra retrieval và khái niệm trong câu trả lời.

## 7. Hạn chế và hướng phát triển

Model 7B vẫn có thể suy luận sai hoặc trích dẫn chưa hoàn toàn chính xác. Chất lượng phụ thuộc tài liệu nguồn, OCR, retrieval và model.

Hướng phát triển: lưu file gốc cùng hash/version để re-index an toàn; xóa cache khi tài liệu cùng tên được tải lại; kiểm chứng từng trích dẫn; tóm tắt dài theo map-reduce; lưu memory hội thoại theo session/tài khoản; bổ sung tài khoản, lớp học, dashboard tiến độ và export Anki/PDF.
#   T h u c T a p F i n a l  
 