import re
import unicodedata
from typing import List, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter


def clean_text(text: str) -> str:
    """
    Làm sạch văn bản thô:
    - Chuẩn hóa Unicode dạng NFC (ghép dấu tiếng Việt)
    - Loại bỏ khoảng trắng thừa
    - Chuẩn hóa ngắt dòng
    - Loại bỏ ký tự điều khiển không in được
    """
    if not text:
        return ""
    # Chuẩn hóa dựng sẵn NFC tiếng Việt
    text = unicodedata.normalize('NFC', text)
    # Chuẩn hóa khoảng trắng và dòng trống
    text = re.sub(r'\r\n|\r', '\n', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]{2,}', ' ', text)
    return text.strip()


# Regex nhận diện tiêu đề phân cấp học thuật:
# Cấp 1: I., II., III., CHƯƠNG 1...
# Cấp 2: 1.1., 1.2., 1.3., 3.1.2., v.v.
# Cấp 3: 1., 2., a), b)
SECTION_HEADING_REGEX = re.compile(
    r'(?m)^(?=(?:[IVXLCDM]+\.|\d+\.\d+(?:\.\d+)?|\d+\.|\bCHƯƠNG\s+\d+:?)\s+[A-ZÀ-Ỹ])'
)

def chunk_document_pages(
    pages_data: List[Dict[str, Any]], 
    chunk_size: int = 800, 
    chunk_overlap: int = 150
) -> List[Dict[str, Any]]:
    """
    Cắt nhỏ văn bản theo phân cấp tiêu đề mục (Structure-Aware Chunking).
    Tách theo các tiêu đề (1.1., 1.2., 1.3...) trước để các định nghĩa cốt lõi không bị xé vụn.
    Chỉ khi một mục quá dài mới áp dụng chia nhỏ theo chunk_size.
    """
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", "; ", ", ", " ", ""]
    )
    
    chunks_result = []
    chunk_global_idx = 0
    current_heading = "Tổng quan"
    current_chapter = "Chương mở đầu"
    
    for page in pages_data:
        raw_text = page.get("content", "")
        cleaned = clean_text(raw_text)
        if not cleaned:
            continue
            
        page_num = page["metadata"].get("page", 1)
        source = page["metadata"].get("source", "unknown")

        # Tách trang thành các khối theo tiêu đề mục
        sections = SECTION_HEADING_REGEX.split(cleaned)
        # Loại bỏ các phần rỗng
        sections = [s.strip() for s in sections if s.strip()]
        if not sections:
            sections = [cleaned]

        page_chunks = []
        for sec in sections:
            if len(sec) <= chunk_size:
                page_chunks.append(sec)
            else:
                # Nếu mục quá dài thì mới tách nhỏ bên trong
                sub_chunks = text_splitter.split_text(sec)
                page_chunks.extend(sub_chunks)

        # HỢP NHẤT THÔNG MINH (Smart Merging):
        # Không bao giờ để lại chunk quá ngắn (ví dụ chỉ có mỗi dòng tiêu đề "3.1.2. Các tầng của mô hình OSI")
        # Nối chunk ngắn vào chunk liền kề để LLM có trọn vẹn ngữ cảnh.
        merged_chunks = []
        buffer_chunk = ""
        for c in page_chunks:
            if not buffer_chunk:
                buffer_chunk = c
            elif len(buffer_chunk) + len(c) + 2 <= chunk_size:
                buffer_chunk = buffer_chunk + "\n\n" + c
            else:
                merged_chunks.append(buffer_chunk)
                buffer_chunk = c
        if buffer_chunk:
            merged_chunks.append(buffer_chunk)

        for idx, chunk_text in enumerate(merged_chunks):
            chunk_global_idx += 1
            chunk_id = f"{source}_p{page_num}_c{idx+1}"
            
            # Tự động nhận diện tiêu đề hoặc chương trong chunk
            heading_match = re.search(r'(?m)^(?:([IVXLCDM]+\.|\d+(?:\.\d+)*\.?|\bCHƯƠNG\s+\d+:?)\s+([^\n]+))', chunk_text)
            if heading_match:
                full_h = heading_match.group(0).strip()[:100]
                current_heading = full_h
                if "chương" in full_h.lower():
                    current_chapter = full_h

            chunk_metadata = dict(page["metadata"])
            chunk_metadata["chunk_id"] = chunk_id
            chunk_metadata["chunk_index"] = chunk_global_idx
            chunk_metadata["char_length"] = len(chunk_text)
            chunk_metadata["heading"] = current_heading
            chunk_metadata["chapter"] = current_chapter
            
            chunks_result.append({
                "text": chunk_text,
                "metadata": chunk_metadata
            })
            
    return chunks_result
