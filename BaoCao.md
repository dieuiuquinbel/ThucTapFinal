# BÁO CÁO KỸ THUẬT
## SmartStudy RAG — Hệ thống quản lý tài liệu và ôn luyện học tập thông minh

## 1. Bài toán và mục tiêu

Sinh viên thường phải học từ giáo trình, slide và tài liệu dài. Việc tìm nội dung bằng mắt hoặc tìm từ khóa truyền thống mất thời gian, đặc biệt khi cách đặt câu hỏi khác với câu trong tài liệu. Chatbot thông thường lại có thể trả lời theo kiến thức chung, không bám sát giáo trình môn học.

SmartStudy RAG giải quyết bài toán này bằng **RAG (Retrieval-Augmented Generation — sinh nội dung có tăng cường bằng truy xuất)**. Khi người dùng hỏi, chương trình không yêu cầu AI trả lời ngay. Trước tiên, chương trình tìm các đoạn liên quan trong tài liệu; sau đó đưa những đoạn đó cho AI làm căn cứ để tạo câu trả lời.

Mục tiêu của hệ thống:

- Đọc PDF, DOCX, TXT bằng tiếng Việt.
- Hỗ trợ PDF scan hoặc sơ đồ chứa chữ bằng OCR.
- Trả lời câu hỏi theo tài liệu đã tải lên và cho biết nguồn/trang liên quan.
- Tạo quiz, flashcard, tóm tắt để hỗ trợ ôn tập.
- Chạy local qua Ollama để giảm phụ thuộc API AI bên ngoài.

## 2. Kiến trúc tổng thể

```text
Người dùng
    │
    ▼
React + Vite + Tailwind CSS
    │ REST API / SSE
    ▼
FastAPI Backend
    ├── Xử lý tài liệu / Document Processing
    ├── Vector Retrieval / Truy xuất vector
    └── Sinh nội dung / Content Generation
            │
            ▼
        Ollama Local Models
```

Hệ thống được tách thành ba khối. Khối xử lý tài liệu chỉ đọc và chuẩn hóa file. Khối vector retrieval chỉ tìm bằng chứng. Khối sinh nội dung chỉ nhận bằng chứng đã tìm được để diễn đạt thành câu trả lời. Việc tách này giúp dễ xác định nguyên nhân khi kết quả sai và dễ thay thế từng công nghệ sau này.

## 3. Công nghệ sử dụng

| Công nghệ | Nhóm | Mục đích | File áp dụng |
|---|---|---|---|
| React 19 | Frontend | Xây dựng giao diện web tương tác | `frontend/src/App.jsx` |
| Vite | Frontend | Chạy development server và build frontend | `frontend/` |
| Tailwind CSS | Frontend | Thiết kế giao diện responsive | `frontend/src/index.css` |
| Axios / Fetch API | Frontend | Gọi REST API và đọc SSE stream | `frontend/src/App.jsx` |
| Lucide React | Frontend | Cung cấp icon giao diện | `frontend/src/App.jsx` |
| FastAPI | Backend | Xây dựng endpoint upload, chat, quiz, flashcard, summary | `server.py` |
| Pydantic | Backend | Kiểm tra dữ liệu request | `server.py` |
| Uvicorn | Backend | Chạy ASGI server FastAPI | lệnh khởi động |
| PyMuPDF | Xử lý PDF | Đọc text layer, ảnh nhúng, render trang | `document_loader.py` |
| python-docx | Xử lý DOCX | Đọc đoạn văn, page break, bảng Word | `document_loader.py` |
| EasyOCR + PyTorch | OCR | Đọc chữ từ scan/ảnh/sơ đồ | `document_loader.py` |
| LangChain Text Splitter | Chunking | Chia văn bản dài thành đoạn nhỏ | `text_processor.py` |
| BGE-M3 | Embedding | Biến text thành vector ngữ nghĩa | `embedding_service.py` |
| ChromaDB | Vector Database | Lưu/tìm vector, nội dung và metadata | `vector_store.py` |
| Ollama | Model runtime | Chạy BGE-M3, Qwen và Llama tại máy local | `llm_service.py` |
| Qwen 2.5 7B | Generation model | Sinh câu trả lời, quiz, flashcard, tóm tắt | `llm_service.py` |
| Llama 3.1 8B | Fallback model | Dự phòng nếu Qwen không xử lý được | `llm_service.py` |

## 4. Khối xử lý tài liệu — Document Processing

### 4.1. Nhiệm vụ

Khối này biến file người dùng tải lên thành text có cấu trúc. Nếu không có bước này, vector database và AI không thể tìm kiếm đúng nội dung từ PDF/Word thô.

### 4.2. PyMuPDF dùng để làm gì?

**PyMuPDF**, được import bằng tên `fitz`, là thư viện đọc PDF. Nó thực hiện các việc sau:

- Mở PDF theo từng trang.
- Lấy **text layer**, tức phần chữ thật được nhúng trong PDF.
- Liệt kê ảnh/sơ đồ nhúng trong một trang.
- Render trang PDF thành ảnh khi cần OCR trang scan.

Với PDF được xuất từ Word hoặc PowerPoint, text layer thường đầy đủ nên PyMuPDF là cách đọc nhanh, chính xác và ít tốn tài nguyên nhất.

### 4.3. EasyOCR dùng để làm gì?

**EasyOCR** là công nghệ OCR — **Optical Character Recognition (nhận diện ký tự quang học)**. Nó được dùng khi PyMuPDF không đọc được chữ vì chữ nằm trong ảnh, sơ đồ hoặc vì toàn bộ trang là ảnh scan.

Quy trình OCR hiện tại:

1. Nếu trang PDF có ít text, chương trình kiểm tra các ảnh lớn trên trang.
2. EasyOCR đọc chữ trong tối đa hai ảnh lớn đó.
3. Chỉ những từ/câu có confidence đủ cao mới được giữ lại để giảm chữ rác.
4. Nếu không có text layer, chương trình render cả trang thành PNG rồi OCR toàn trang.

EasyOCR được cấu hình chạy **CPU**, không dùng GPU. Lý do: RTX 4050 chỉ có 6 GB VRAM; để OCR và Qwen cùng chiếm GPU dễ làm Qwen thiếu VRAM hoặc chậm. OCR thường xảy ra lúc upload, còn VRAM nên ưu tiên cho chatbot lúc hỏi đáp.

### 4.4. python-docx dùng để làm gì?

**python-docx** đọc file Word DOCX. Hệ thống lấy paragraph, phát hiện page break và trích dữ liệu bảng. Dữ liệu bảng được chuyển thành text để vẫn có thể embedding và retrieval.

Lưu ý: `.doc` đời cũ không được python-docx hỗ trợ hoàn chỉnh; định dạng được khuyến nghị là `.docx`.

### 4.5. Chunking dùng để làm gì?

Tài liệu dài không thể đưa nguyên file vào Qwen mỗi lần hỏi. Vì vậy `RecursiveCharacterTextSplitter` chia nội dung thành các **chunk**.

- Kích thước chunk: khoảng 1.200 ký tự.
- Overlap: 200 ký tự giữa hai chunk kề nhau.
- Có ưu tiên phân tách theo tiêu đề/mục trước, sau đó mới cắt theo dấu xuống dòng, câu và từ.

Chunk đủ lớn để có ý trọn vẹn; overlap giúp không mất ý ở chỗ giao nhau. Mỗi chunk còn lưu metadata: file nguồn, trang, chunk index và độ dài.

Mã: `modules/document_loader.py`, `modules/text_processor.py`.

## 5. Khối Vector Retrieval — Truy xuất vector

### 5.1. Nhiệm vụ

Khối này tìm câu trả lời trong tài liệu. Nó không viết câu trả lời; nó chọn các đoạn tài liệu phù hợp để đưa cho model sinh nội dung.

### 5.2. BGE-M3 là gì và làm gì?

**BGE-M3** là **Embedding Model (mô hình nhúng)**. Input của nó là text; output là vector 1.024 chiều. Vector là một danh sách số biểu diễn ý nghĩa của câu/đoạn văn.

BGE-M3 có tác dụng tìm theo **ngữ nghĩa**, không chỉ tìm từ giống nhau. Ví dụ:

- Câu hỏi: “Chức năng phương pháp luận có ý nghĩa gì?”
- Tài liệu: “Hệ thống nguyên tắc định hướng nhận thức và hành động.”

Hai câu không giống hoàn toàn về từ, nhưng ý liên quan nên vector sẽ gần nhau. Nhờ đó hệ thống có khả năng tìm đoạn phù hợp tốt hơn tìm kiếm keyword thuần túy.

Trong chương trình, BGE-M3 chạy qua Ollama tại `modules/embedding_service.py`. Khi upload, toàn bộ chunk được embedding; khi hỏi, câu hỏi cũng được embedding theo cùng model để so sánh.

### 5.3. ChromaDB là gì và làm gì?

**ChromaDB** là **Vector Database (cơ sở dữ liệu vector)**. Nó lưu:

- Text chunk.
- Vector BGE-M3 tương ứng.
- Tên tài liệu.
- Trang chứa chunk.
- Chunk index và metadata.

Khi có câu hỏi, ChromaDB nhận vector câu hỏi, tính khoảng cách cosine với vector các chunk và trả về các chunk gần nhất. Vì vậy chương trình không phải đọc tuần tự toàn bộ hàng trăm trang.

ChromaDB không phải model AI và không sinh câu trả lời. Nó chỉ là kho dữ liệu tối ưu cho tìm kiếm theo ý nghĩa.

### 5.4. Hybrid Reranking là gì?

Sau khi ChromaDB lấy các candidate, chương trình dùng **Hybrid Reranking (xếp hạng lại kết hợp)** trong `modules/vector_store.py`.

Điểm cuối cùng gồm:

- Semantic score: mức tương đồng ý nghĩa từ embedding/cosine similarity.
- Lexical score: mức độ các từ khóa trong câu hỏi xuất hiện trong chunk.
- Bonus score: ưu tiên chunk có dấu hiệu phù hợp với câu hỏi định nghĩa, vai trò, chức năng hoặc liệt kê.

Kết quả là đoạn vừa đúng nghĩa vừa đúng thuật ngữ có khả năng đứng trên các đoạn chỉ “na ná” về chủ đề.

## 6. Khối sinh nội dung — Content Generation

### 6.1. Qwen 2.5 7B là gì?

**Qwen 2.5 7B** là Local LLM — **Large Language Model (mô hình ngôn ngữ lớn)** chính. Nó chịu trách nhiệm tạo nội dung bằng tiếng Việt: câu trả lời chat, quiz JSON, flashcard và tóm tắt.

Qwen không đọc trực tiếp cả file PDF. Nó chỉ nhận các chunk mà vector retrieval đã tìm được, cùng câu hỏi và lịch sử hội thoại gần. Cách này giảm context không cần thiết, tăng tốc và làm câu trả lời bám sát tài liệu hơn.

### 6.2. Llama 3.1 8B dùng khi nào?

**Llama 3.1 8B** là fallback model — **model dự phòng**. Luồng thực tế:

1. Người dùng gửi yêu cầu.
2. Hệ thống gọi `qwen2.5:7b` trước.
3. Nếu Qwen bị lỗi kết nối, timeout, không nạp được model hoặc lỗi trước khi trả dữ liệu, hệ thống tự gửi lại cùng yêu cầu sang `llama3.1:8b`.
4. Nếu Llama trả lời được, người dùng vẫn nhận kết quả; giao diện có thể hiển thị model đã dùng.

Nói đơn giản: nếu model chính không xử lý được yêu cầu thì chương trình tự động chuyển từ Qwen sang Llama, không bắt người dùng thao tác lại.

### 6.3. SSE Streaming dùng để làm gì?

**SSE — Server-Sent Events** là cách backend gửi dữ liệu dần từ server xuống frontend. Khi model sinh câu trả lời, FastAPI gửi từng token/đoạn qua `/api/chat/stream`; React nhận và thêm dần vào khung chat.

Lợi ích là người dùng thấy phản hồi sớm thay vì chờ model tạo xong toàn bộ câu trả lời.

Mã: `modules/llm_service.py`, `modules/rag_pipeline.py`, `server.py`, `frontend/src/App.jsx`.

## 7. Chức năng chương trình và file liên quan

| Chức năng | Mô tả cách hoạt động | File chính |
|---|---|---|
| Upload | Đọc file → OCR khi cần → chunking → BGE-M3 embedding → ChromaDB | `server.py`, `document_loader.py` |
| Chat RAG | Retrieval → rerank → prompt → Qwen/Llama → SSE | `rag_pipeline.py`, `llm_service.py` |
| Quiz | Lấy chunk đại diện, yêu cầu model sinh JSON 4 đáp án | `quiz_generator.py`, `server.py` |
| Flashcard | Yêu cầu model trích thuật ngữ, định nghĩa, chủ đề | `quiz_generator.py` |
| Tóm tắt | Sinh tóm tắt theo ba cấp độ; lưu JSON cache | `summarizer.py` |
| Cache tóm tắt | Nếu đã có cùng tên tài liệu và mức tóm tắt, trả kết quả cache thay vì gọi model | `data/cache_summaries.json` |
| Cache quiz | Cache đề theo tên tài liệu, độ khó và số câu; trả lại nhanh khi có dữ liệu hợp lệ | `data/cache_quizzes.json`, `quiz_generator.py` |
| Benchmark | Chạy 15 câu hỏi để đo retrieval và khái niệm kỳ vọng | `scripts/run_benchmark_15.py` |

## 8. Các giai đoạn đã triển khai

### Giai đoạn 1 — Xây dựng nền tảng

- Tạo frontend React + Vite + Tailwind CSS.
- Tạo FastAPI backend.
- Xây endpoint upload, danh sách/xóa tài liệu, chat, quiz, flashcard, summary.
- Kết nối frontend và backend qua REST API.

### Giai đoạn 2 — Xây dựng RAG cơ bản

- Đọc PDF, DOCX, TXT.
- Làm sạch text và chia chunk.
- Tạo embedding và lưu ChromaDB.
- Truy xuất chunk theo câu hỏi.
- Gọi Qwen qua Ollama để sinh trả lời dựa vào chunk.
- Hiển thị nguồn và số trang.

### Giai đoạn 3 — Bổ sung chức năng ôn tập

- Sinh quiz trắc nghiệm A–B–C–D.
- Chấm điểm trực tiếp trên giao diện.
- Sinh flashcard.
- Sinh tóm tắt và tải tóm tắt TXT.

### Giai đoạn 4 — Cải thiện retrieval

- Dùng BGE-M3 làm embedding model đa ngôn ngữ.
- Nâng chunk lên 1.200 ký tự, overlap 200 ký tự.
- Thêm hybrid reranking.
- Điều chỉnh nhận diện follow-up để giảm ghép sai câu hỏi độc lập.
- Xóa chunk cũ khi upload file trùng tên, tránh dữ liệu phiên bản cũ lẫn vào kết quả mới.

### Giai đoạn 5 — OCR, tốc độ và trải nghiệm

- Thêm Hybrid OCR cho ảnh, sơ đồ và PDF scan.
- Chạy OCR CPU để ưu tiên VRAM cho Qwen.
- Thêm SSE streaming.
- Điều chỉnh batch/thread Ollama để phù hợp môi trường local.
- Thêm cache cho tóm tắt theo ba mức: Cơ bản, Trung bình và Nâng cao.
- Thêm cache quiz theo độ khó và số lượng câu; sau upload, tác vụ nền tạo trước quiz 10 câu ở ba mức Dễ, Trung bình và Khó.
- Khi upload lại hoặc xóa tài liệu, hệ thống xóa vector cùng toàn bộ cache tóm tắt/quiz của tên tài liệu đó trước khi tạo dữ liệu mới.
- Tạo benchmark 15 câu hỏi độc lập và follow-up.

## 9. Ưu điểm

- Chạy local, hạn chế gửi tài liệu lên dịch vụ AI bên ngoài.
- Có retrieval theo ý nghĩa, không chỉ theo từ khóa.
- Có tên file/số trang để người dùng kiểm tra nguồn.
- Có OCR cho tài liệu scan và sơ đồ.
- Có failover khi Qwen lỗi.
- Tích hợp chat, quiz, flashcard, tóm tắt trong một ứng dụng.
- Kiến trúc module hóa; có thể thay model hoặc vector database sau này.

## 10. Hạn chế

- Model 7B có thể suy luận sai hoặc trích dẫn chưa hoàn toàn chính xác.
- OCR có thể sai với ảnh mờ, nghiêng, chữ viết tay hoặc font lạ.
- Tóm tắt tài liệu rất dài hiện dùng chunk lấy mẫu, chưa bao phủ mọi chi tiết như cách map-reduce.
- Memory chat chỉ giữ một số lượt gần, chưa lưu lâu dài theo người dùng.
- Cache tóm tắt và quiz hiện khóa theo tên file thay vì hash/nội dung. Dù cache được xóa khi thao tác qua API, hai file khác nhau cùng tên vẫn chưa được phân biệt theo phiên bản.
- File upload hiện là file tạm; re-index tự động lâu dài cần lưu file gốc, hash và version.
- Hiệu năng phụ thuộc CPU, RAM, VRAM và kích thước tài liệu.
- API chưa có xác thực và CORS đang mở rộng; chỉ nên chạy trên máy cục bộ hoặc mạng tin cậy cho đến khi bổ sung bảo vệ truy cập.
- Luồng fallback ở giao diện khi SSE lỗi cần được kiểm thử/sửa riêng; hiện biến lịch sử chat dùng trong nhánh fallback không nằm đúng phạm vi khai báo.
- Upload chưa giới hạn kích thước và chưa kiểm tra chặt loại file ở backend; client chỉ giới hạn bằng thuộc tính chọn tệp của trình duyệt.

## 11. Cập nhật hiện trạng mã nguồn (13/10/2026)

- Backend hiện có endpoint kiểm tra trạng thái Ollama, model đang dùng, số tài liệu và tổng số chunk.
- Sau khi upload thành công, FastAPI chạy background task để tạo trước ba bản tóm tắt và ba bộ quiz 10 câu; người dùng vẫn có thể sử dụng các chức năng khác trong lúc tác vụ chạy.
- Cache tóm tắt được lưu tại `data/cache_summaries.json`; cache quiz được lưu tại `data/cache_quizzes.json`. Cache được xóa khi upload thay thế hoặc xóa tài liệu qua API.
- Giao diện React lưu lịch sử chat ở `localStorage`, hiển thị trạng thái Ollama, tiến trình upload mô phỏng, streaming SSE, quiz có chấm điểm và flashcard lật thẻ.
- Kiểm tra kỹ thuật gần nhất: Python compile và Vite production build thành công. Bộ `tests/` hiện là script gọi API/benchmark, chưa phải unit test tự động có assertion; môi trường cũng chưa khai báo `pytest`.

## 12. Hướng phát triển

- Lưu file gốc, hash và version tài liệu.
- Invalidate cache dựa trên hash file thay vì tên file.
- Kiểm chứng từng trích dẫn với chunk nguồn.
- Bổ sung reranker đa ngôn ngữ chuyên dụng.
- Dùng map-reduce/hierarchical summarization cho tài liệu dài.
- Lưu memory theo session/tài khoản.
- Thêm tài khoản sinh viên, lớp học, dashboard tiến độ và export Anki/PDF.

## 13. Câu hỏi thường gặp khi bảo vệ

**BGE-M3 có trả lời câu hỏi không?** Không. BGE-M3 chỉ biến text thành vector để tìm tài liệu liên quan. Qwen hoặc Llama mới sinh câu trả lời.

**ChromaDB có phải AI không?** Không. ChromaDB là cơ sở dữ liệu vector, dùng để lưu và tìm các đoạn có ý nghĩa gần câu hỏi.

**Vì sao cần cả BGE-M3 và Qwen?** BGE-M3 tìm đúng đoạn tài liệu; Qwen đọc đoạn đó và diễn đạt thành câu trả lời. Hai công nghệ làm hai nhiệm vụ khác nhau.

**Nếu Qwen lỗi thì sao?** Hệ thống tự gọi Llama 3.1 8B với cùng prompt. Đây là cơ chế failover.

**Vì sao không gửi cả giáo trình vào Qwen?** Giáo trình dài hơn context model, gửi toàn bộ vừa chậm vừa làm AI mất tập trung. RAG chỉ đưa các đoạn liên quan.

**OCR dùng để làm gì?** OCR đọc chữ trong PDF scan hoặc sơ đồ ảnh, nơi PDF không có text layer cho PyMuPDF lấy.
