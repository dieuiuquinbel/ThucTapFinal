# SmartStudy RAG — Hệ thống quản lý tài liệu và ôn luyện học tập thông minh

SmartStudy RAG là ứng dụng web giúp sinh viên học tập và ôn luyện hiệu quả từ chính tài liệu của mình. Người dùng tải lên các tệp PDF, DOCX hoặc TXT; hệ thống tự động bóc tách, chuẩn hóa dữ liệu, tìm kiếm các đoạn thông tin liên quan bằng phương pháp Hybrid Retrieval và dùng AI để giải đáp thắc mắc, sinh câu hỏi trắc nghiệm, tạo flashcard cũng như tóm tắt bài giảng.

Hệ thống hoạt động theo mô hình **RAG (Retrieval-Augmented Generation — Sinh phản hồi tăng cường qua truy xuất tài liệu)**: Mọi câu trả lời của AI đều được đối chiếu, căn cứ trực tiếp trên ngữ cảnh các trang tài liệu cụ thể kèm trích dẫn số trang và tên tệp nguồn.

---

## 1. Chức năng chính

- **Quản lý tài liệu đa định dạng:** Tải lên, phân tích cấu trúc, xem danh sách và xóa tài liệu PDF, DOCX, TXT.
- **Bóc tách văn bản & OCR kết hợp:** Đọc text layer chính xác với PyMuPDF; tự động nhận diện chữ từ hình ảnh, sơ đồ và trang scan bằng EasyOCR (chạy CPU).
- **Hỏi đáp thông minh kèm bằng chứng:** Trả lời chi tiết, trích dẫn rõ tên tệp và số trang nguồn; hỗ trợ nhận diện câu hỏi tiếp nối (follow-up query) từ hội thoại trước.
- **Sinh trắc nghiệm & Flashcard:** Tự động tạo câu hỏi trắc nghiệm 4 đáp án A–B–C–D, chấm điểm trực tiếp, giải thích tường minh; trích xuất thẻ học thông minh từ thuật ngữ quan trọng.
- **Tóm tắt tài liệu 3 cấp độ:** Cơ bản, Trung bình, Nâng cao; có bộ nhớ đệm (cache) để tái sử dụng ngay lập tức.
- **Hệ thống tài khoản & Bảo mật:** Xác thực người dùng bằng JWT Token (PyJWT, mật khẩu mã hóa bcrypt) và cơ chế OTP kích hoạt tài khoản.
- **Phản hồi Streaming & Failover thông minh:** Truyền luồng phản hồi trực tiếp (Server-Sent Events) và tự động chuyển sang mô hình dự phòng nhẹ nếu mô hình chính bận hoặc gặp sự cố.

---

## 2. Kiến trúc hệ thống

```text
Người dùng (Trình duyệt)
    │
    ▼
React + Vite + Tailwind CSS (Giao diện Web SPA)
    │ REST API & Server-Sent Events (SSE)
    ▼
FastAPI Backend
    ├── Xác thực & Phân quyền (AuthService)
    │   ├── PyJWT: Quản lý access token (yêu cầu cấu hình JWT_SECRET)
    │   └── bcrypt: Mã hóa băm mật khẩu bảo mật
    │
    ├── Xử lý tài liệu (Document Processing)
    │   ├── PyMuPDF (fitz): Đọc PDF text layer & trích xuất metadata trang
    │   ├── python-docx: Bóc tách văn bản và cấu trúc bảng Word
    │   ├── EasyOCR (CPU inference): Nhận diện chữ trong ảnh/trang scan
    │   └── Text Cleaning: Chuẩn hóa Unicode NFC, loại bỏ Header/Footer lặp tự động
    │
    ├── Truy xuất ngữ nghĩa đa tầng (Hybrid Retrieval)
    │   ├── Dense Retrieval: BGE-M3 (1.024 chiều qua Ollama)
    │   ├── Sparse/Lexical Search: BM25 (rank_bm25) so khớp từ khóa chính xác
    │   ├── ChromaDB: Lưu trữ vector nhúng cùng nội dung chunk và metadata
    │   └── Cross-Encoder Reranker: FlashRank (ONNX Runtime) sắp xếp lại kết quả
    │
    └── Sinh nội dung (Content Generation)
        ├── Qwen 2.5 7B: Mô hình ngôn ngữ chính
        ├── Qwen 2.5 3B: Mô hình dự phòng siêu nhẹ (Failover an toàn, tránh OOM)
        └── Streaming SSE: Truyền nội dung sinh tức thì ra giao diện
```

---

## 3. Chi tiết các thành phần kỹ thuật

### 3.1. Xử lý tài liệu — Document Processing

Chuyển đổi tài liệu thô thành các khối văn bản sạch (clean chunks), giữ nguyên số trang và ngữ cảnh:

| Công nghệ | Vai trò kỹ thuật | Đặc điểm triển khai |
|---|---|---|
| **PyMuPDF (fitz)** | Trích xuất PDF text layer | Tốc độ cao, trích xuất chính xác theo từng trang kèm kích thước trang. |
| **EasyOCR** | Nhận diện ký tự quang học (OCR) | Chạy hoàn toàn trên **CPU (`gpu=False`)** nhằm nhường trọn vẹn 6 GB VRAM card đồ họa cho LLM Qwen 7B. |
| **python-docx** | Đọc tệp Word DOCX | Đọc đoạn văn bản, page break và cấu trúc dòng/cột của các bảng biểu. |
| **Dynamic Header/Footer Filter** | Lọc đầu trang / chân trang | Tự động thống kê tần suất xuất hiện lặp lại của dòng đầu/cuối qua các trang (ngưỡng 50%) để loại bỏ mà không cần hard-code. |
| **LangChain Splitter** | Phân mảnh văn bản (Chunking) | `chunk_size = 800 - 1200`, `chunk_overlap = 150 - 200` ký tự, đảm bảo ngữ nghĩa tiếng Việt không bị ngắt quãng giữa các ranh giới. |

### 3.2. Truy xuất đa tầng — Hybrid Retrieval & Reranking

Để đảm bảo vừa hiểu sâu ngữ nghĩa vừa không bỏ sót thuật ngữ/từ khóa chuyên ngành:

1. **Dense Semantic Search (BGE-M3):** Biến đổi văn bản thành vector 1.024 chiều. Tự động kiểm tra giá trị vector NaN/Inf để đảm bảo độ ổn định cho ChromaDB.
2. **Lexical Sparse Search (BM25Okapi):** Thuật toán tìm kiếm dựa trên tần suất từ khóa chuẩn xác, hỗ trợ tìm nhanh các mã hiệu, thuật ngữ khoa học hoặc số liệu.
3. **Cross-Encoder Reranking (FlashRank):** Sử dụng mô hình `ms-marco-TinyBERT-L-2-v2` chạy trên nền tảng **ONNX Runtime** (chỉ tốn ~3 MB dung lượng và độ trễ dưới 5 ms) để chấm điểm tương đồng ngữ cảnh chéo giữa câu hỏi và đoạn trích, lấy ra top các nguồn chính xác nhất (`top_k=4`).

### 3.3. Sinh nội dung & Chuyển đổi dự phòng (Failover)

- **Qwen 2.5 7B:** Đóng vai trò LLM cốt lõi với khả năng xử lý tiếng Việt vượt trội, nắm bắt ngữ cảnh tốt và tuân thủ định dạng sinh JSON (cho Quiz/Flashcard).
- **Qwen 2.5 3B (Dự phòng thông minh):** Thay vì sử dụng các mô hình 8B nặng nề dễ gây tràn bộ nhớ (Out-Of-Memory) trên card 6GB, hệ thống cấu hình `qwen2.5:3b` làm failover. Nếu model 7B không phản hồi hoặc quá tải, hệ thống tự động định tuyến sang model 3B mà không gián đoạn trải nghiệm của người dùng.
- **Context Window:** Cấu hình ngữ cảnh tối đa 8.192 tokens, bao gồm system instruction, các nguồn retrieved, lịch sử chat ngắn và câu trả lời đang sinh.

### 3.4. Xác thực & Bảo mật (Authentication & Security)

- **Bảo mật JWT:** Hệ thống sử dụng `PyJWT` với thuật toán mã hóa `HS256`. 
- **Bắt buộc cấu hình `JWT_SECRET`:** Để tránh lỗ hổng giả mạo token do sử dụng chuỗi khóa mặc định, mã nguồn **bắt buộc đọc `JWT_SECRET` từ file `.env`** và sẽ ném lỗi từ chối khởi động nếu biến này chưa được thiết lập.
- **Băm mật khẩu:** Toàn bộ mật khẩu người dùng được băm an toàn qua thư viện `bcrypt` với muối (salt) ngẫu nhiên.

---

## 4. Yêu cầu & Cài đặt

### Yêu cầu hệ thống

- **Hệ điều hành:** Windows 10/11 (hoặc Linux/macOS).
- **Môi trường:** Python 3.10+, Node.js 18+ (khuyến nghị Node 20+), Git.
- **Phần cứng khuyến nghị:** RAM tối thiểu 16 GB; GPU rời NVIDIA (khuyến nghị RTX 3060/4050 6GB VRAM trở lên).
- **Ollama:** Cài đặt từ [https://ollama.com](https://ollama.com) và đang chạy ngầm.

---

### Hướng dẫn cài đặt từng bước

#### Bước 1: Cài đặt các gói phụ thuộc Python

```powershell
# Kích hoạt môi trường ảo (nếu dùng venv)
.\venv\Scripts\activate

# Cài đặt toàn bộ thư viện cần thiết
pip install -r requirements.txt
```

> **Danh mục thư viện trọng yếu được cài đặt:**
> - `fastapi`, `uvicorn`, `pydantic`: Web framework & API Server
> - `PyJWT`, `bcrypt`: Cơ chế xác thực an toàn & băm mật khẩu
> - `ollama`, `chromadb`, `langchain-text-splitters`: RAG & Vector database
> - `rank_bm25`, `flashrank`, `onnxruntime`: Hybrid search & Cross-encoder reranker
> - `pymupdf`, `python-docx`, `easyocr`, `torch`: Bóc tách văn bản, đọc Word & OCR
> - `python-dotenv`: Quản lý nạp biến môi trường

#### Bước 2: Thiết lập file môi trường (.env)

Tạo file `.env` từ file mẫu `.env.example`:

```powershell
copy .env.example .env
```

Mở file `.env` và cấu hình các biến bảo mật:

```ini
# BẮT BUỘC: Thay đổi thành chuỗi ngẫu nhiên bí mật của riêng bạn
JWT_SECRET=your_super_secret_jwt_random_key_here

# Cấu hình gửi mail OTP (Tùy chọn: nếu để trống, mã OTP sẽ in ra terminal backend)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM='"SmartStudy EdTech" <noreply@smartstudy.edu.vn>'
ALLOW_DEV_OTP_HINT=true
```

#### Bước 3: Cài đặt giao diện Frontend (React)

```powershell
cd frontend
npm install
cd ..
```

#### Bước 4: Tải các mô hình Ollama cần thiết

Mở cửa sổ dòng lệnh và tải các mô hình sau:

```powershell
# Mô hình LLM chính (7B)
ollama pull qwen2.5:7b

# Mô hình LLM dự phòng (3B - nhẹ, chống tràn VRAM)
ollama pull qwen2.5:3b

# Mô hình Embedding đa ngôn ngữ
ollama pull bge-m3
```

---

## 5. Khởi chạy ứng dụng

### Cách 1: Khởi động tự động bằng script (Khuyên dùng)

Chạy file script tích hợp để khởi chạy đồng thời Ollama, FastAPI backend và Frontend:

```powershell
.\start_all.bat
```

Mở trình duyệt tại địa chỉ: `http://127.0.0.1:3000`

---

### Cách 2: Khởi động thủ công qua từng Terminal

- **Terminal 1 — Khởi chạy Ollama:**
  ```powershell
  ollama serve
  ```

- **Terminal 2 — Khởi chạy FastAPI Backend (Port 8080):**
  ```powershell
  .\venv\Scripts\activate
  python -m uvicorn server:app --host 127.0.0.1 --port 8080 --reload
  ```

- **Terminal 3 — Khởi chạy React Frontend (Port 3000):**
  ```powershell
  cd frontend
  npm run dev -- --host 127.0.0.1 --port 3000
  ```

---

## 6. Kiểm thử & Benchmark

Chạy bộ kiểm thử tự động đánh giá độ chính xác của cơ chế Retrieval và câu trả lời AI:

```powershell
.\venv\Scripts\python.exe scripts\run_benchmark_15.py
```

Bộ benchmark gồm 15 câu hỏi thực nghiệm (câu hỏi độc lập và chuỗi câu hỏi tiếp nối follow-up) giúp kiểm tra độ bao phủ kiến thức và khả năng trích dẫn ngữ cảnh.

---

## 7. Ghi chú kỹ thuật & Hướng phát triển

### Lưu ý kỹ thuật về tài nguyên và hiệu năng:

1. **OCR trên CPU (`gpu=False`):**
   - *Lý do:* Trên các dòng máy GPU 6GB VRAM (như RTX 4050 Laptop), việc chia sẻ VRAM giữa PyTorch EasyOCR và LLM Qwen 7B rất dễ dẫn đến lỗi tràn bộ nhớ (CUDA Out-Of-Memory).
   - *Lưu ý:* Việc chạy EasyOCR trên CPU đảm bảo tính ổn định tối đa cho hệ thống, tuy nhiên tốc độ xử lý các tệp PDF scan hoàn toàn hoặc hình ảnh độ phân giải cao sẽ tốn thêm thời gian xử lý ban đầu khi nạp tài liệu.
2. **Cấu trúc bảng biểu trong PDF:**
   - Định dạng DOCX được hỗ trợ trích xuất nguyên vẹn bảng biểu thông qua `python-docx`.
   - Đối với tệp PDF kỹ thuật có bảng phức tạp, nội dung hiện được bóc tách theo dòng văn bản hoặc qua OCR. Khuyến nghị tài liệu nguồn có định dạng văn bản rõ ràng để đạt chất lượng trích xuất tốt nhất.
3. **Giới hạn Context Window 8.192 tokens:**
   - Được thiết lập phù hợp với năng lực suy luận của mô hình 7B cục bộ, đảm bảo tốc độ phản hồi mượt mà và chất lượng câu trả lời tập trung.
4. **Cơ chế Singleton & Đột biến truy vấn:**
   - Trong môi trường nhiều người dùng đồng thời, các tác vụ nhúng vector nên được điều phối qua hàng đợi (task queue) để phân bổ tuần tự tài nguyên GPU của Ollama.

### Hướng phát triển tiếp theo:
- Nâng cấp bộ định dạng lại truy vấn (`reformulate_query`) sang mô hình ngôn ngữ siêu nhỏ (như `qwen2.5:1.5b` hoặc `3b`) để giải quyết các đoạn hội thoại phức tạp đa chủ đề.
- Bổ sung bộ phân tích bảng PDF chuyên dụng (như `pdfplumber` hoặc `tabula-py`).
- Mở rộng hỗ trợ xuất bộ thẻ học sang định dạng Anki (`.apkg`) và tóm tắt xuất tệp PDF/Markdown.