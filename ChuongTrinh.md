# Kế hoạch triển khai đề tài

## Tên đề tài

**Xây dựng hệ thống quản lý tài liệu và ôn luyện học tập thông minh dựa trên kỹ thuật RAG và Mô hình ngôn ngữ lớn chạy cục bộ (Local LLM).**

## 1. Định hướng chung

Hệ thống được xây dựng nhằm hỗ trợ sinh viên lưu trữ, khai thác và ôn tập tài liệu học tập một cách chủ động. Người dùng có thể tải tài liệu môn học, đặt câu hỏi bằng ngôn ngữ tự nhiên, nhận câu trả lời dựa trên đúng nội dung tài liệu, đồng thời sử dụng các chức năng tóm tắt và tạo câu hỏi trắc nghiệm để ôn tập.

Điểm cốt lõi của đề tài là kiến trúc **RAG (Retrieval-Augmented Generation)**. Thay vì để mô hình AI tự trả lời theo kiến thức tổng quát, hệ thống sẽ truy xuất các đoạn nội dung phù hợp từ tài liệu người dùng đã tải lên, sau đó cung cấp chúng làm ngữ cảnh cho Local LLM tạo câu trả lời. Cách tiếp cận này giúp hạn chế hiện tượng trả lời sai hoặc “ảo giác”, đồng thời bảo mật tài liệu vì dữ liệu và mô hình đều có thể chạy cục bộ.

Hệ thống được định hướng ưu tiên xử lý **tài liệu và hội thoại tiếng Việt**. Mô hình chính là **Qwen 2.5 7B** (tên Ollama: `qwen2.5:7b`), phù hợp cho tác vụ tiếng Việt, hỏi đáp, tóm tắt và tạo nội dung có cấu trúc. **Llama 3.1 8B** được tích hợp như mô hình dự phòng. Khi Qwen 2.5 7B gặp lỗi tải mô hình, hết thời gian phản hồi hoặc không tạo được đầu ra hợp lệ, hệ thống tự động chuyển sang Llama 3.1 8B để bảo đảm chức năng không bị gián đoạn.

Mức 7B–8B được chọn làm cấu hình chuẩn vì cân bằng tốt giữa chất lượng phản hồi, khả năng chạy cục bộ và yêu cầu tài nguyên. Mô hình **Qwen 2.5 14B** (tên Ollama: `qwen2.5:14b`) có thể được dùng ở hướng mở rộng nếu thiết bị có GPU/RAM đủ mạnh, nhưng không phải cấu hình bắt buộc của sản phẩm chính.

## 2. Kiến trúc và luồng xử lý hệ thống

```text
Người dùng
    │
    ▼
Giao diện Web Streamlit
    ├── Tải tài liệu PDF / DOCX / PPTX
    ├── Xem danh sách tài liệu
    ├── Đặt câu hỏi
    ├── Tóm tắt nội dung
    └── Làm bài trắc nghiệm
    │
    ▼
Module xử lý tài liệu
    ├── Trích xuất văn bản
    ├── Làm sạch dữ liệu
    ├── Chia đoạn văn bản (chunking)
    └── Gắn metadata: tên file, số trang, vị trí đoạn văn
    │
    ▼
Mô hình Embedding tiếng Việt
    │
    ▼
Vector Database – ChromaDB
    │
    ▼
RAG Pipeline
    ├── Nhận câu hỏi người dùng
    ├── Tìm các đoạn liên quan nhất trong ChromaDB
    ├── Ghép câu hỏi và ngữ cảnh tài liệu thành prompt
    └── Chọn mô hình LLM khả dụng
    │
    ├── Ưu tiên: Qwen 2.5 7B qua Ollama
    └── Dự phòng: Llama 3.1 8B qua Ollama
    │
    ▼
Kết quả
    ├── Trả lời câu hỏi kèm trích dẫn trang
    ├── Tóm tắt nội dung
    └── Sinh Flashcard / Quiz trắc nghiệm
```

## 3. Công nghệ sử dụng

| Thành phần | Công nghệ đề xuất | Vai trò |
|---|---|---|
| Ngôn ngữ lập trình | Python 3.10+ | Xây dựng toàn bộ ứng dụng |
| Giao diện web | Streamlit | Tạo giao diện tải tài liệu, chat, quiz và thống kê |
| Xử lý RAG | LangChain | Điều phối quy trình nạp dữ liệu, truy xuất và tạo câu trả lời |
| Vector Database | ChromaDB | Lưu vector tài liệu và tìm kiếm ngữ nghĩa |
| Embedding tiếng Việt | Vietnamese bi-encoder hoặc sentence-transformers đa ngôn ngữ | Chuyển văn bản thành vector ngữ nghĩa |
| LLM chính | Qwen 2.5 7B qua Ollama (`qwen2.5:7b`) | Hỏi đáp, tóm tắt, sinh quiz; ưu tiên tiếng Việt |
| LLM dự phòng | Llama 3.1 8B qua Ollama | Duy trì hoạt động nếu mô hình chính lỗi |
| Xử lý PDF | PyMuPDF, pdfplumber hoặc PyPDF | Trích xuất nội dung và số trang |
| Lưu dữ liệu mở rộng | SQLite / PostgreSQL | Lưu người dùng, tài liệu, lịch sử và kết quả học tập |

## 4. Cơ chế lựa chọn và dự phòng Local LLM

Hệ thống tích hợp hai mô hình chạy cục bộ qua Ollama nhưng chỉ ưu tiên một mô hình tại một thời điểm:

1. **Qwen 2.5 7B** (lệnh khởi chạy: `ollama run qwen2.5:7b`) là mô hình chính. Mọi tác vụ hỏi đáp, tóm tắt, sinh câu hỏi và Flashcard được gửi tới mô hình này trước tiên.
2. Hệ thống kiểm tra tình trạng mô hình: Ollama có đang chạy hay không, model có được tải thành công hay không và phản hồi có vượt quá thời gian chờ quy định hay không.
3. Nếu Qwen 2.5 7B không phản hồi, phát sinh lỗi kết nối, trả về đầu ra rỗng hoặc tạo JSON không hợp lệ sau khi thử lại, hệ thống chuyển yêu cầu sang **Llama 3.1 8B**.
4. Trên máy cá nhân có VRAM 6–8 GB hoặc chạy bằng CPU/RAM, Ollama thường không giữ đồng thời cả hai mô hình trong bộ nhớ. Khi failover, Ollama cần giải phóng mô hình cũ và nạp mô hình dự phòng; thao tác này có thể tạo độ trễ khoảng 10–20 giây.
5. Trong thời gian đó, giao diện phải hiển thị spinner với thông báo: **“Đang chuyển đổi sang mô hình dự phòng...”** để người dùng biết hệ thống vẫn đang xử lý, không bị treo.
6. Nếu mô hình dự phòng cũng không khả dụng, giao diện hiển thị thông báo rõ ràng và hướng dẫn người dùng thử lại sau, thay vì tạo câu trả lời không đáng tin cậy.
7. Khi Qwen 2.5 7B hoạt động trở lại, hệ thống tự quay về dùng mô hình chính cho các yêu cầu tiếp theo.

Với các phản hồi cần có cấu trúc như câu hỏi trắc nghiệm, hệ thống yêu cầu LLM xuất dữ liệu JSON. Dữ liệu sẽ được kiểm tra trước khi hiển thị. Nếu JSON không hợp lệ, hệ thống sẽ yêu cầu tạo lại; nếu vẫn lỗi thì chuyển sang mô hình dự phòng.

## 5. Kế hoạch triển khai theo từng giai đoạn

### Giai đoạn 1: Khảo sát yêu cầu và chuẩn bị môi trường

Mục tiêu của giai đoạn này là xác định rõ phạm vi hệ thống, công nghệ sử dụng và xây dựng môi trường phát triển ổn định.

Các nội dung cần thực hiện:

- Xác định đối tượng sử dụng chính là sinh viên có nhu cầu học và ôn tập từ tài liệu môn học.
- Xác định định dạng tài liệu ưu tiên là PDF; DOCX và PPTX được bổ sung ở mức mở rộng.
- Cài đặt Python, môi trường ảo và các thư viện cần thiết.
- Cài đặt Ollama để chạy mô hình ngôn ngữ cục bộ.
- Tải và kiểm tra Qwen 2.5 7B (`qwen2.5:7b`) cùng Llama 3.1 8B.
- Kiểm thử khả năng hỏi đáp tiếng Việt, tóm tắt tiếng Việt và sinh JSON của cả hai mô hình.
- Lựa chọn mô hình embedding có hỗ trợ tiếng Việt tốt.
- Cài đặt ChromaDB để lưu vector tài liệu.
- Chuẩn bị tài liệu học tập thật để kiểm thử, ví dụ Mạng máy tính, Hệ điều hành, Lập trình Web hoặc Cơ sở dữ liệu.

Kết quả đầu ra:

- Môi trường chạy được hai Local LLM qua Ollama.
- Có cơ chế xác định mô hình chính và mô hình dự phòng.
- Có thể gửi thử câu hỏi tiếng Việt tới hai mô hình qua terminal.
- Có bộ tài liệu mẫu phục vụ phát triển và đánh giá.
- Có cấu trúc thư mục mã nguồn rõ ràng.

Gợi ý cấu trúc dự án:

```text
rag-learning-assistant/
│
├── app.py
├── requirements.txt
├── README.md
│
├── data/
│   ├── uploads/
│   └── processed/
│
├── chroma_db/
│
├── modules/
│   ├── document_loader.py
│   ├── text_processor.py
│   ├── embedding_service.py
│   ├── vector_store.py
│   ├── llm_service.py
│   ├── rag_pipeline.py
│   ├── quiz_generator.py
│   └── summarizer.py
│
└── tests/
```

### Giai đoạn 2: Xây dựng module xử lý tài liệu

Mục tiêu là biến tài liệu đầu vào thành dữ liệu có cấu trúc, có thể tìm kiếm ngữ nghĩa và truy xuất theo số trang.

Các chức năng chính:

- Tải tài liệu PDF từ giao diện.
- Kiểm tra định dạng, dung lượng và tên file.
- Đọc nội dung PDF theo từng trang bằng `PyPDFLoader`, `pdfplumber` hoặc `PyMuPDF`.
- Trích xuất phần văn bản của từng trang.
- Làm sạch dữ liệu: xóa khoảng trắng dư thừa, dòng rỗng, ký tự đặc biệt không cần thiết và các phần lặp như chân trang.
- Chia tài liệu thành các đoạn nhỏ bằng `RecursiveCharacterTextSplitter`.
- Gắn metadata cho từng đoạn gồm tên tài liệu, số trang, mã đoạn văn bản, thời điểm tải lên và môn học hoặc chủ đề.

Ví dụ dữ liệu sau xử lý:

```json
{
  "content": "Giao thức TCP cung cấp cơ chế truyền dữ liệu đáng tin cậy...",
  "metadata": {
    "file_name": "Mang_may_tinh.pdf",
    "page": 15,
    "chunk_id": "mmt_15_03",
    "subject": "Mạng máy tính"
  }
}
```

Kết quả đầu ra:

- Người dùng tải được PDF lên hệ thống.
- Nội dung PDF được tách thành các đoạn nhỏ.
- Mỗi đoạn có số trang và thông tin nguồn.
- Có thể kiểm tra số lượng đoạn văn bản tạo ra từ mỗi tài liệu.

### Giai đoạn 3: Xây dựng Vector Database và tìm kiếm ngữ nghĩa

Mục tiêu là lưu trữ nội dung tài liệu dưới dạng vector để hệ thống hiểu được sự tương đồng về nghĩa, thay vì chỉ tìm kiếm theo từ khóa.

Quy trình xử lý:

1. Mỗi đoạn văn bản được đưa vào mô hình embedding tiếng Việt.
2. Mô hình chuyển đoạn văn thành vector số.
3. Vector và metadata được lưu vào ChromaDB.
4. Khi người dùng đặt câu hỏi, câu hỏi cũng được chuyển thành vector.
5. Hệ thống tìm các đoạn tài liệu có vector gần nhất.
6. Các đoạn phù hợp nhất được trả về làm ngữ cảnh cho Local LLM.

Các nội dung cần triển khai:

- Tạo collection riêng cho mỗi tài liệu hoặc người dùng.
- Thiết lập số lượng kết quả truy xuất, ví dụ `top_k = 3` hoặc `top_k = 5`.
- Hiển thị điểm tương đồng để phục vụ kiểm thử nội bộ.
- Xây dựng chức năng xóa dữ liệu vector khi người dùng xóa tài liệu.
- Tránh trùng lặp dữ liệu khi tải lại cùng một tài liệu.
- Lưu ID tài liệu để quản lý dữ liệu nhất quán.

Kết quả đầu ra:

- Tài liệu đã tải có thể được truy xuất bằng câu hỏi tự nhiên tiếng Việt.
- Hệ thống tìm được đoạn liên quan ngay cả khi câu hỏi không trùng hoàn toàn với từ trong tài liệu.
- Có thể xác định tên file và số trang của đoạn được truy xuất.

### Giai đoạn 4: Xây dựng RAG Pipeline hỏi đáp tài liệu

Đây là phần quan trọng nhất của đề tài. Mục tiêu là giúp Local LLM trả lời dựa trên tài liệu đã tải và có dẫn nguồn cụ thể.

Quy trình hỏi đáp:

```text
Người dùng nhập câu hỏi
        │
        ▼
Hệ thống tìm các đoạn tài liệu liên quan
        │
        ▼
Ghép câu hỏi và ngữ cảnh thành prompt tiếng Việt
        │
        ▼
Gửi prompt tới Qwen 2.5 7B
        │
        ├── Thành công → hiển thị kết quả
        └── Lỗi / quá thời gian → chuyển sang Llama 3.1 8B
        │
        ▼
Hiển thị câu trả lời và trang tài liệu tham chiếu
```

Nguyên tắc prompt:

- Chỉ trả lời dựa trên nội dung trong phần ngữ cảnh được cung cấp.
- Nếu tài liệu không chứa thông tin cần thiết, mô hình phải trả lời: “Không tìm thấy thông tin phù hợp trong tài liệu đã tải.”
- Không tự suy đoán hoặc bổ sung kiến thức ngoài tài liệu.
- Trả lời bằng tiếng Việt rõ ràng, ngắn gọn và phù hợp với bối cảnh học tập.
- Nêu tên tài liệu và số trang tham khảo khi có nguồn.
- Khi có nhiều nguồn, liệt kê đầy đủ các trang liên quan.

Ví dụ đầu ra:

```text
TCP là giao thức hướng kết nối, có cơ chế kiểm soát lỗi và đảm bảo dữ liệu được truyền đầy đủ, đúng thứ tự.

Nguồn tham khảo:
- Mang_may_tinh.pdf, trang 15
- Mang_may_tinh.pdf, trang 16
```

Kết quả đầu ra:

- Người dùng có thể hỏi đáp trực tiếp với tài liệu.
- Câu trả lời bám sát nội dung tài liệu.
- Mỗi câu trả lời có hiển thị nguồn tham khảo.
- Hệ thống biết từ chối trả lời khi tài liệu không có thông tin phù hợp.
- Hệ thống có khả năng tự chuyển mô hình nếu mô hình chính gặp lỗi.

### Giai đoạn 5: Xây dựng chức năng tóm tắt tài liệu

Mục tiêu là hỗ trợ sinh viên nắm nhanh nội dung quan trọng trước khi học hoặc ôn thi.

Các mức tóm tắt có thể triển khai:

- Tóm tắt toàn bộ tài liệu.
- Tóm tắt theo từng chương.
- Tóm tắt theo phạm vi trang do người dùng chọn.
- Tóm tắt dạng gạch đầu dòng.
- Tóm tắt dạng các ý chính cần ghi nhớ.
- Tóm tắt theo phong cách ôn thi nhanh.

Quy trình thực hiện:

- Lấy nội dung tài liệu hoặc các đoạn thuộc phần người dùng chọn.
- Nếu tài liệu dài, chia thành nhiều phần nhỏ.
- Tóm tắt từng phần bằng mô hình chính hoặc mô hình dự phòng khi cần.
- Gộp và rút gọn thành bản tóm tắt cuối cùng.
- Hiển thị rõ phần tài liệu hoặc trang mà bản tóm tắt dựa vào.

Kết quả đầu ra:

- Người dùng nhận được bản tóm tắt tiếng Việt rõ ràng, có cấu trúc.
- Có thể sao chép hoặc tải nội dung tóm tắt.
- Hỗ trợ giảm thời gian đọc lại tài liệu dài.

### Giai đoạn 6: Xây dựng chức năng tạo câu hỏi trắc nghiệm và Flashcard

Mục tiêu là chuyển tài liệu thành nội dung ôn luyện tương tác.

Các chức năng cần có:

- Chọn tài liệu hoặc phần tài liệu muốn tạo câu hỏi.
- Chọn số lượng câu hỏi: 5, 10 hoặc 20 câu.
- Sinh câu hỏi trắc nghiệm có bốn đáp án A, B, C, D.
- Xác định một đáp án đúng.
- Có phần giải thích đáp án dựa trên tài liệu.
- Sinh Flashcard gồm mặt trước là thuật ngữ/câu hỏi và mặt sau là định nghĩa/lời giải thích.
- Hiển thị điểm sau khi làm bài.
- Cho phép xem lại các câu trả lời sai.

Dữ liệu đầu ra nên ở định dạng JSON để giao diện xử lý ổn định:

```json
{
  "question": "Chức năng chính của giao thức TCP là gì?",
  "options": {
    "A": "Truyền dữ liệu không đảm bảo",
    "B": "Đảm bảo truyền dữ liệu đáng tin cậy",
    "C": "Chỉ định địa chỉ IP",
    "D": "Mã hóa dữ liệu"
  },
  "correct_answer": "B",
  "explanation": "TCP đảm bảo dữ liệu được truyền đúng thứ tự và đầy đủ.",
  "source_page": 15
}
```

Hệ thống phải kiểm tra JSON trước khi hiển thị. Nếu Qwen 2.5 7B trả về sai cấu trúc, hệ thống yêu cầu tạo lại; nếu vẫn không hợp lệ thì chuyển sang Llama 3.1 8B.

Kết quả đầu ra:

- Người dùng làm bài trắc nghiệm trực tiếp trên web.
- Hệ thống chấm điểm và giải thích đáp án.
- Câu hỏi liên kết với tài liệu nguồn.
- Có thể dùng Flashcard để ôn tập nhanh.

### Giai đoạn 7: Hoàn thiện giao diện web

Giao diện triển khai thực tế dùng React + Vite + Tailwind CSS, tập trung vào sự đơn giản, rõ ràng và dễ demo. Streamlit chỉ còn là phiên bản cũ, không phải giao diện chạy chính.

| Màn hình | Nội dung |
|---|---|
| Trang chủ | Giới thiệu hệ thống và hướng dẫn sử dụng |
| Quản lý tài liệu | Tải lên, xem danh sách và xóa tài liệu |
| Hỏi đáp tài liệu | Khung chat, lịch sử hội thoại, trích dẫn nguồn và trạng thái mô hình |
| Tóm tắt | Chọn tài liệu, phạm vi và kiểu tóm tắt |
| Ôn luyện Quiz | Tạo đề, làm bài, xem điểm và đáp án |
| Flashcard | Xem thẻ, lật thẻ và chuyển câu tiếp theo |
| Thống kê | Số tài liệu, số câu hỏi đã làm và tỷ lệ đúng nếu triển khai mức mở rộng |

Các nguyên tắc giao diện:

- Có thông báo trạng thái khi tài liệu đang được xử lý.
- Hiển thị tiến trình khi tạo embedding.
- Không cho đặt câu hỏi khi chưa có tài liệu.
- Có thông báo lỗi rõ ràng nếu file không hợp lệ.
- Phần trích dẫn nguồn dễ nhìn, ví dụ: `Nguồn: Tên file – trang 12`.
- Hiển thị mô hình đang được sử dụng; chỉ báo khi hệ thống đã chuyển sang mô hình dự phòng.
- Trong lúc chuyển model, hiển thị spinner: **“Đang chuyển đổi sang mô hình dự phòng...”**. Trạng thái này đặc biệt cần thiết trên laptop có VRAM 6–8 GB hoặc chạy bằng CPU/RAM, vì Ollama phải giải phóng model cũ và nạp model mới.
- Giữ lại lịch sử chat trong phiên sử dụng.

### Giai đoạn 8: Kiểm thử và đánh giá hệ thống

Cần kiểm thử trên nhiều loại tài liệu và nhiều nhóm câu hỏi khác nhau.

Các nhóm kiểm thử:

- Câu hỏi có đáp án rõ ràng trong tài liệu.
- Câu hỏi cần tổng hợp nội dung từ nhiều đoạn hoặc nhiều trang.
- Câu hỏi không có thông tin trong tài liệu.
- Tài liệu tiếng Việt có bảng biểu, ký hiệu hoặc tiêu đề dài.
- Tài liệu có dung lượng lớn.
- Câu hỏi trắc nghiệm được sinh tự động.
- Khả năng hiển thị nguồn trích dẫn.
- Khả năng tự chuyển sang Llama 3.1 8B khi Qwen 2.5 7B không khả dụng.
- Khả năng xử lý thông báo lỗi khi cả hai mô hình đều không hoạt động.

Khung đánh giá định lượng RAGAS:

- Chuẩn bị bộ dữ liệu đánh giá gồm câu hỏi, câu trả lời tham chiếu và các đoạn ngữ cảnh được truy xuất từ tài liệu mẫu.
- Sử dụng thư viện **Ragas** để đánh giá pipeline RAG một cách tự động.
- Đo chỉ số **Faithfulness** để xác định mức độ trung thực của câu trả lời đối với ngữ cảnh đã truy xuất; chỉ số cao cho thấy mô hình ít tự suy diễn ngoài tài liệu.
- Đo chỉ số **Context Recall** để đánh giá mức độ các ngữ cảnh truy xuất bao phủ thông tin cần thiết cho câu trả lời tham chiếu.
- Có thể bổ sung **Answer Relevancy** và **Context Precision** nếu đủ dữ liệu đánh giá.
- Tổng hợp các chỉ số theo từng bộ tài liệu và theo từng cấu hình model để so sánh Qwen 2.5 7B với Llama 3.1 8B khi cần.

Các tiêu chí đánh giá:

| Tiêu chí | Nội dung đánh giá |
|---|---|
| Độ chính xác | Câu trả lời có đúng nội dung tài liệu không |
| Mức độ bám sát nguồn | Câu trả lời có dựa vào đoạn tài liệu đã truy xuất không |
| Trích dẫn | Tên tài liệu và số trang có chính xác không |
| Thời gian phản hồi | Thời gian từ lúc gửi câu hỏi đến khi có câu trả lời |
| Tính liên tục | Hệ thống có tiếp tục hoạt động khi mô hình chính lỗi không |
| Faithfulness (Ragas) | Câu trả lời có trung thực với ngữ cảnh đã truy xuất không |
| Context Recall (Ragas) | Ngữ cảnh truy xuất có bao phủ thông tin cần thiết cho câu trả lời không |
| Chất lượng Quiz | Câu hỏi có rõ ràng, đúng kiến thức và có đáp án hợp lý không |
| Trải nghiệm người dùng | Giao diện có dễ dùng và dễ hiểu không |
| Độ ổn định | Hệ thống có lỗi khi tải nhiều tài liệu hoặc hỏi liên tục không |

## 6. Ba mức chương trình có thể thực hiện

### Mức 1 – MVP cơ bản

Đây là mức tối thiểu cần hoàn thành để chứng minh đề tài hoạt động đúng theo kiến trúc RAG.

Bao gồm:

- Tải lên một file PDF.
- Tách văn bản và chia đoạn.
- Lưu embedding vào ChromaDB.
- Hỏi đáp theo nội dung PDF.
- Hiển thị câu trả lời bằng tiếng Việt.
- Hiển thị tên tài liệu và số trang tham khảo.
- Chạy Qwen 2.5 7B (`qwen2.5:7b`) qua Ollama.
- Có Llama 3.1 8B làm phương án dự phòng.
- Giao diện Streamlit cơ bản.

Giá trị đạt được:

- Có sản phẩm chạy thật.
- Thể hiện rõ quy trình RAG.
- Có thể demo hỏi đáp trực tiếp trên giáo trình hoặc slide môn học.
- Phù hợp nếu cấu hình máy hạn chế hoặc cần ưu tiên độ ổn định.

### Mức 2 – Ứng dụng ôn luyện hoàn chỉnh

Mức này mở rộng MVP thành một hệ thống học tập có giá trị sử dụng thực tế hơn.

Bao gồm toàn bộ mức 1, cùng với:

- Quản lý nhiều tài liệu.
- Chọn tài liệu cần hỏi đáp.
- Tóm tắt tài liệu hoặc theo chương.
- Sinh câu hỏi trắc nghiệm A, B, C, D.
- Chấm điểm bài làm.
- Hiển thị lời giải thích đáp án.
- Sinh Flashcard.
- Lưu lịch sử hỏi đáp trong phiên làm việc.
- Xóa tài liệu và dữ liệu vector tương ứng.
- Hiển thị trạng thái xử lý tài liệu và trạng thái mô hình.
- Tự động chuyển mô hình dự phòng khi mô hình chính gặp lỗi.

Giá trị đạt được:

- Hệ thống không chỉ trả lời câu hỏi mà hỗ trợ quy trình học và ôn tập.
- Có nhiều chức năng để trình bày trong demo và báo cáo.
- Phù hợp làm sản phẩm chính để nộp thực tập.

### Mức 3 – Hệ thống học tập cá nhân hóa và có khả năng mở rộng

Đây là mức phát triển nâng cao, phù hợp làm phần hướng phát triển hoặc triển khai khi còn đủ nguồn lực. Mức này biến ứng dụng từ công cụ hỏi đáp tài liệu thành nền tảng học tập cá nhân hóa.

Bao gồm toàn bộ mức 2, cùng với các chức năng mở rộng sau.

#### 6.3.1. Tài khoản và phân quyền người dùng

- Đăng ký, đăng nhập và đăng xuất.
- Mỗi người dùng có kho tài liệu riêng.
- Tài liệu và vector database được tách riêng theo tài khoản.
- Phân quyền sinh viên, giảng viên và quản trị viên.
- Giảng viên có thể tải tài liệu chung cho lớp học.

#### 6.3.2. Quản lý môn học, học phần và thư viện tài liệu

- Tạo danh mục môn học.
- Gắn tài liệu vào từng học phần.
- Gắn tag theo chủ đề: Chương 1, Chương 2, Ôn giữa kỳ, Ôn cuối kỳ.
- Tìm kiếm theo tên tài liệu, môn học hoặc từ khóa.
- Lưu phiên bản tài liệu khi giảng viên cập nhật tài liệu mới.

#### 6.3.3. Học tập cá nhân hóa

- Lưu các câu hỏi người dùng đã hỏi.
- Lưu lịch sử làm Quiz.
- Thống kê số câu đúng, sai theo từng chủ đề.
- Phát hiện phần kiến thức người dùng còn yếu.
- Tự đề xuất tài liệu, Flashcard hoặc câu hỏi phù hợp để ôn lại.
- Gợi ý lộ trình ôn tập dựa trên kết quả làm bài.

Ví dụ gợi ý:

```text
Bạn thường trả lời sai các câu thuộc Chương 3: Giao thức tầng vận chuyển.
Hệ thống đề xuất:
- Đọc lại trang 42–50.
- Làm 10 câu Quiz về TCP và UDP.
- Ôn 8 Flashcard về các giao thức mạng.
```

#### 6.3.4. Sinh đề kiểm tra thông minh

- Tạo đề theo số lượng câu hỏi.
- Chọn độ khó: dễ, trung bình, khó.
- Chọn chương hoặc chủ đề.
- Trộn thứ tự câu hỏi và đáp án.
- Quy định thời gian làm bài.
- Xuất đề dưới dạng PDF hoặc DOCX.
- Tạo nhiều mã đề.
- Sinh bảng đáp án và giải thích.

#### 6.3.5. Cải thiện chất lượng RAG

- Áp dụng Hybrid Search, kết hợp tìm kiếm vector và tìm kiếm từ khóa BM25.
- Sử dụng reranker để chọn lại các đoạn ngữ cảnh tốt nhất.
- Tối ưu chunking theo cấu trúc chương, mục và tiêu đề.
- Hỗ trợ truy xuất bảng biểu, hình ảnh, công thức và sơ đồ trong tài liệu.
- Dùng kỹ thuật mở rộng truy vấn để tăng khả năng tìm đúng nội dung.
- Đánh giá chất lượng truy xuất bằng bộ câu hỏi – đáp án mẫu.
- Cho phép người dùng phản hồi “câu trả lời hữu ích” hoặc “không hữu ích”.

#### 6.3.6. Hỗ trợ nhiều định dạng và đa phương tiện

- Đọc DOCX, PPTX, TXT và Markdown.
- Trích xuất nội dung từ ảnh hoặc PDF scan bằng OCR.
- Tạo nội dung ôn tập từ slide bài giảng.
- Hỗ trợ ghi âm bài giảng và chuyển giọng nói thành văn bản.
- Tạo tóm tắt từ nội dung ghi âm.
- Cho phép đặt câu hỏi bằng giọng nói.

#### 6.3.7. Triển khai và vận hành thực tế

- Đóng gói ứng dụng bằng Docker.
- Dùng FastAPI làm backend khi hệ thống lớn hơn.
- Tách frontend và backend để dễ mở rộng.
- Lưu thông tin người dùng, tài liệu và lịch sử bằng PostgreSQL hoặc MySQL.
- Triển khai trong mạng nội bộ trường hoặc máy chủ riêng.
- Có cơ chế sao lưu dữ liệu.
- Bổ sung đăng nhập bảo mật, mã hóa mật khẩu và kiểm soát quyền truy cập.
- Có dashboard quản trị thống kê người dùng, tài liệu và lượt truy vấn.
- Khi có hạ tầng đủ mạnh, thử nghiệm Qwen 2.5 14B (`qwen2.5:14b`) để so sánh chất lượng với cấu hình chuẩn 7B–8B.

## 7. Kết quả sản phẩm dự kiến

Sản phẩm hoàn chỉnh có thể bao gồm:

- Website chạy trên máy tính cá nhân hoặc máy chủ nội bộ.
- Tải và quản lý tài liệu học tập.
- Hỏi đáp tiếng Việt dựa trên tài liệu với trích dẫn nguồn.
- Tóm tắt nội dung tài liệu.
- Sinh Quiz trắc nghiệm và Flashcard.
- Chấm điểm và giải thích đáp án.
- Cơ chế Local LLM chính – dự phòng nhằm duy trì hoạt động.
- Kho tài liệu theo môn học.
- Mã nguồn có cấu trúc rõ ràng.
- Tài liệu hướng dẫn cài đặt và sử dụng.
- Bộ tài liệu mẫu để demo.
- Báo cáo đánh giá về độ chính xác, thời gian phản hồi, khả năng dự phòng và trải nghiệm sử dụng.

## 8. Cập nhật hiện trạng triển khai (13/10/2026)

Các phần sau đã được triển khai trong mã nguồn hiện tại:

- Backend FastAPI và frontend React + Vite + Tailwind CSS giao tiếp qua REST API và SSE.
- Upload PDF, DOCX, TXT; PDF scan/ảnh/sơ đồ được OCR khi điều kiện trích xuất văn bản không đáp ứng.
- ChromaDB lưu embedding BGE-M3; retrieval dùng cosine similarity, lexical score và các bonus theo loại câu hỏi.
- Chat hỗ trợ lịch sử gần, nhận diện một số câu hỏi tiếp nối, streaming và failover model tại tầng backend.
- Quiz có ba mức Dễ, Trung bình, Khó; frontend hỗ trợ làm bài, chấm điểm và xem lời giải. Flashcard và ba cấp độ tóm tắt cũng đã có giao diện.
- Sau upload, background task tạo trước cache tóm tắt ở ba mức và cache quiz 10 câu ở ba độ khó. Khi upload lại/xóa tài liệu, cache tóm tắt và quiz của tài liệu đó được xóa.

Các mục chưa hoàn thành hoặc cần làm rõ khi báo cáo:

- Tóm tắt hiện lấy các chunk mẫu trải đều, chưa phải map-reduce hay tóm tắt toàn bộ từng chương như mô tả định hướng.
- Cache hiện nhận diện tài liệu bằng tên tệp, chưa bằng hash/phiên bản nội dung.
- Hệ thống chưa có tài khoản, phân quyền, lưu file gốc lâu dài hoặc cơ sở dữ liệu người dùng.
- Bộ kiểm thử hiện gồm benchmark/script gọi API; chưa có unit/integration test tự động với assertion.
- Cần sửa và kiểm thử riêng nhánh fallback của frontend khi SSE lỗi; đồng thời bổ sung validation kích thước/loại file ở backend trước khi triển khai ngoài máy cục bộ.

## 9. Hướng phát triển lâu dài

Về lâu dài, hệ thống có thể trở thành nền tảng học tập nội bộ cho khoa hoặc trường. Các hướng phát triển quan trọng gồm:

- Tích hợp dữ liệu môn học từ hệ thống LMS của trường.
- Cho phép giảng viên tạo học liệu và ngân hàng câu hỏi.
- Hỗ trợ học nhóm và chia sẻ tài liệu có kiểm soát quyền truy cập.
- Xây dựng chatbot riêng cho từng môn học.
- So sánh chất lượng phản hồi giữa các Local LLM 7B–8B và 14B.
- Fine-tuning mô hình theo thuật ngữ chuyên ngành của trường.
- Xây dựng hệ thống đánh giá tự động dựa trên phản hồi sinh viên.
- Phát triển phiên bản mobile hoặc Progressive Web App.
- Cải thiện xử lý tiếng Việt, đặc biệt với tài liệu chuyên ngành kỹ thuật.
- Ứng dụng phân tích dữ liệu học tập để đưa ra gợi ý ôn tập cá nhân hóa.

## 10. Định hướng triển khai đề xuất

**Mức 2 là mục tiêu triển khai chính**, vì hệ thống đã thể hiện đầy đủ kiến trúc RAG, có chức năng hỏi đáp, tóm tắt và ôn luyện trực quan để demo. Cấu hình mặc định sử dụng **Qwen 2.5 7B** (`qwen2.5:7b`) để tối ưu tiếng Việt và hiệu năng; **Llama 3.1 8B** chỉ đảm nhận vai trò dự phòng khi mô hình chính xảy ra sự cố.

**Mức 3** nên được trình bày là hướng phát triển có chiều sâu, cho thấy sản phẩm có thể mở rộng thành hệ thống học tập cá nhân hóa trong thực tế. Mô hình Qwen 2.5 14B chỉ nên được xem là phương án nghiên cứu hoặc nâng cấp khi thiết bị triển khai đáp ứng yêu cầu tài nguyên.
