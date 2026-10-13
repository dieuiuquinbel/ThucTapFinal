import os
import unicodedata
import fitz  # PyMuPDF
from typing import List, Dict, Any


def detect_and_clean_repetitive_lines(pages_raw_text: List[str], threshold_ratio: float = 0.5) -> List[str]:
    """
    Thuật toán tự động nhận diện các dòng lặp lại (Header/Footer động) xuất hiện ở >= threshold_ratio số trang.
    Không hard-code bất kỳ tên giảng viên hay tiêu đề cụ thể nào.
    """
    total_pages = len(pages_raw_text)
    if total_pages < 3:
        return pages_raw_text

    line_counts = {}
    page_candidate_lines = []

    for text in pages_raw_text:
        lines = [line.strip() for line in text.split('\n') if line.strip()]
        # Lấy tối đa 2 dòng đầu và 2 dòng cuối của trang làm ứng viên header/footer
        candidates = set()
        if len(lines) >= 1:
            candidates.add(lines[0])
        if len(lines) >= 2:
            candidates.add(lines[1])
        if len(lines) >= 3:
            candidates.add(lines[-1])
        if len(lines) >= 4:
            candidates.add(lines[-2])
            
        page_candidate_lines.append(candidates)
        for c in candidates:
            # Bỏ qua các dòng quá ngắn (số trang thuần túy ví dụ '1', '2') vì số trang thay đổi theo từng trang
            if len(c) > 5:
                line_counts[c] = line_counts.get(c, 0) + 1

    # Những dòng xuất hiện lặp lại ở >= 50% số trang sẽ bị coi là header/footer
    repetitive_headers_footers = {
        line for line, count in line_counts.items() 
        if (count / total_pages) >= threshold_ratio
    }

    cleaned_pages = []
    for text in pages_raw_text:
        lines = text.split('\n')
        filtered_lines = [l for l in lines if l.strip() not in repetitive_headers_footers]
        cleaned_pages.append('\n'.join(filtered_lines).strip())

    return cleaned_pages


# Chạy EasyOCR hoàn toàn trên CPU (gpu=False) để dành 100% VRAM 6GB cho Ollama và Qwen 7B
_ocr_reader = None

def get_ocr_reader():
    global _ocr_reader
    if _ocr_reader is None:
        try:
            import easyocr
            # Bắt buộc chạy CPU, tránh tranh chấp CUDA memory với LLM
            _ocr_reader = easyocr.Reader(['vi', 'en'], gpu=False)
        except Exception as e:
            print(f"[OCR] Không thể khởi tạo EasyOCR: {e}")
            _ocr_reader = False
    return _ocr_reader if _ocr_reader is not False else None


def ocr_image_bytes(img_bytes: bytes, min_confidence: float = 0.55) -> str:
    """
    Nhận diện chữ từ ảnh bằng EasyOCR trên CPU kèm bộ lọc điểm tin cậy (Confidence Filter).
    Chỉ giữ lại các từ/câu có điểm tin cậy >= min_confidence để loại bỏ nhiễu/icon rác.
    """
    reader = get_ocr_reader()
    if not reader:
        return ""
    try:
        # detail=1 trả về danh sách tuple: (bbox, text, prob)
        results = reader.readtext(img_bytes, detail=1)
        valid_words = []
        for res in results:
            if len(res) >= 3:
                text = str(res[1]).strip()
                prob = float(res[2])
                if prob >= min_confidence and len(text) > 1:
                    valid_words.append(text)
        return " ".join(valid_words)
    except Exception as e:
        print(f"[OCR] Lỗi khi nhận diện hình ảnh: {e}")
        return ""


def extract_text_from_pdf(file_path: str) -> List[Dict[str, Any]]:
    """
    Trích xuất nội dung văn bản từ file PDF theo từng trang bằng PyMuPDF.
    TÍCH HỢP HYBRID OCR:
    1. Trích xuất text layer nguyên bản của trang.
    2. Nếu trên trang có chứa hình ảnh/sơ đồ nhúng: Bóc ảnh và chạy EasyOCR để lấy chữ trong ảnh.
    3. Nếu cả trang là ảnh scan hoàn toàn (< 30 ký tự): Chụp lại toàn bộ trang và chạy OCR toàn trang.
    """
    file_name = unicodedata.normalize('NFC', os.path.basename(file_path))
    
    doc = fitz.open(file_path)
    raw_pages = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        raw_text = page.get_text("text").strip()
        text = unicodedata.normalize('NFC', raw_text)
        
        # Chỉ chạy OCR khi trang có ít chữ (< 150 ký tự) mà chứa hình ảnh sơ đồ, hoặc cả trang là ảnh scan
        # Nếu trang đã có đầy đủ văn bản (> 150 ký tự), PyMuPDF đọc ngay lập tức trong 0.01s!
        if len(text.strip()) < 150:
            embedded_ocr_texts = []
            image_list = page.get_images(full=True)
            if image_list:
                for img_info in image_list[:2]:  # Chỉ OCR tối đa 2 ảnh lớn nhất trên trang
                    xref = img_info[0]
                    base_image = doc.extract_image(xref)
                    image_bytes = base_image.get("image")
                    width = base_image.get("width", 0)
                    height = base_image.get("height", 0)
                    
                    # Chỉ OCR các sơ đồ/bảng biểu kích thước lớn (> 200px)
                    if width >= 200 and height >= 200 and image_bytes:
                        img_text = ocr_image_bytes(image_bytes)
                        if img_text:
                            embedded_ocr_texts.append(img_text)
            
            if embedded_ocr_texts:
                ocr_combined = " ".join(embedded_ocr_texts)
                text += f"\n\n[NỘI DUNG TỪ HÌNH ẢNH / SƠ ĐỒ]:\n{ocr_combined}"
            elif len(text.strip()) < 30:
                # Toàn bộ trang là ảnh scan hoàn toàn
                pix = page.get_pixmap(dpi=130)
                page_img_bytes = pix.tobytes("png")
                page_ocr_text = ocr_image_bytes(page_img_bytes)
                if page_ocr_text:
                    text = f"[VĂN BẢN TỪ BẢN SCAN]:\n{page_ocr_text}"

        raw_pages.append(text)
    doc.close()

    cleaned_pages = detect_and_clean_repetitive_lines(raw_pages, threshold_ratio=0.5)

    pages_data = []
    for page_num, text in enumerate(cleaned_pages):
        if text:  # Bỏ qua trang trống
            pages_data.append({
                "content": text,
                "metadata": {
                    "source": file_name,
                    "page": page_num + 1,  # 1-indexed cho người dùng
                    "total_pages": len(cleaned_pages),
                    "file_path": file_path
                }
            })
    return pages_data


def extract_text_from_docx(file_path: str) -> List[Dict[str, Any]]:
    """
    Trích xuất văn bản từ file DOCX theo từng trang logic.
    Phát hiện ngắt trang (page break) trong XML để phân tách chính xác.
    Nếu không có page break tường minh, chia theo ~45 đoạn/trang.
    """
    import docx
    from docx.oxml.ns import qn

    file_name = os.path.basename(file_path)
    doc = docx.Document(file_path)

    # Thu thập toàn bộ các đoạn văn kèm nhãn page break
    paragraphs_with_breaks = []
    for para in doc.paragraphs:
        text = para.text.strip()
        # Kiểm tra paragraph có chứa page break không
        has_page_break = False
        for run in para.runs:
            # Tìm <w:br w:type="page"/> trong XML của run
            for br in run._element.findall(qn('w:br')):
                if br.get(qn('w:type')) == 'page':
                    has_page_break = True
                    break
            if has_page_break:
                break
        paragraphs_with_breaks.append((text, has_page_break))

    # Trích xuất text từ bảng (tables) nếu có
    table_texts = []
    for table in doc.tables:
        rows_text = []
        for row in table.rows:
            cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if cells:
                rows_text.append(" | ".join(cells))
        if rows_text:
            table_texts.append("\n".join(rows_text))

    # Phân tách thành các trang dựa trên page break
    pages_content = []
    current_page_lines = []
    found_any_break = False

    for text, has_break in paragraphs_with_breaks:
        if has_break and current_page_lines:
            pages_content.append("\n\n".join(current_page_lines))
            current_page_lines = []
            found_any_break = True
        if text:
            current_page_lines.append(text)

    # Thêm trang cuối cùng
    if current_page_lines:
        pages_content.append("\n\n".join(current_page_lines))

    # Nếu không tìm thấy page break nào, chia đều theo ~45 đoạn/trang
    if not found_any_break and len(pages_content) == 1:
        all_lines = [t for t, _ in paragraphs_with_breaks if t]
        if len(all_lines) > 50:
            lines_per_page = 45
            pages_content = []
            for i in range(0, len(all_lines), lines_per_page):
                pages_content.append("\n\n".join(all_lines[i:i + lines_per_page]))

    # Gắn nội dung bảng vào trang cuối cùng (hoặc trang mới nếu trống)
    if table_texts:
        table_combined = "\n\n[BẢNG DỮ LIỆU]:\n" + "\n\n".join(table_texts)
        if pages_content:
            pages_content[-1] += table_combined
        else:
            pages_content.append(table_combined)

    if not pages_content:
        return []

    total_pages = len(pages_content)
    pages_data = []
    for idx, content in enumerate(pages_content):
        if content.strip():
            pages_data.append({
                "content": content,
                "metadata": {
                    "source": file_name,
                    "page": idx + 1,
                    "total_pages": total_pages,
                    "file_path": file_path
                }
            })
    return pages_data


def extract_text_from_txt(file_path: str) -> List[Dict[str, Any]]:
    """
    Đọc file văn bản thuần TXT/MD.
    """
    file_name = os.path.basename(file_path)
    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read().strip()
        
    if not content:
        return []
        
    return [{
        "content": content,
        "metadata": {
            "source": file_name,
            "page": 1,
            "total_pages": 1,
            "file_path": file_path
        }
    }]


def load_document(file_path: str) -> List[Dict[str, Any]]:
    """
    Tự động nhận diện định dạng file và gọi hàm trích xuất tương ứng.
    """
    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".pdf":
        return extract_text_from_pdf(file_path)
    elif ext == ".docx":
        return extract_text_from_docx(file_path)
    elif ext == ".doc":
        raise ValueError("Định dạng .doc cũ (Word 97-2003) không được hỗ trợ trực tiếp. Vui lòng mở tệp bằng Word và Lưu dưới dạng (Save As) sang .docx hoặc .pdf trước khi tải lên.")
    elif ext in [".txt", ".md"]:
        return extract_text_from_txt(file_path)
    else:
        raise ValueError(f"Định dạng tệp {ext} chưa được hỗ trợ. Chỉ hỗ trợ .pdf, .docx, .txt.")
