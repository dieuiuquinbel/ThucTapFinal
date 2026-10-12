import sys
import unicodedata
from modules.vector_store import VectorStore
from modules.text_processor import chunk_document_pages

sys.stdout.reconfigure(encoding='utf-8')
vs = VectorStore()

# 1. Lấy toàn bộ dữ liệu thô hiện tại từ ChromaDB
data = vs.collection.get(include=['documents', 'metadatas'])
docs = data['documents']
metas = data['metadatas']
print(f"Số lượng chunk cũ trước khi tái chỉ mục: {len(docs)}")

# Tái tạo lại văn bản thô theo từng trang
pages_dict = {}
for d, m in zip(docs, metas):
    page = m['page']
    source = m.get('source', 'Chương 2_Kiến trúc phân tầng.pdf')
    total_pages = m.get('total_pages', 21)
    file_path = m.get('file_path', source)
    
    if page not in pages_dict:
        pages_dict[page] = {
            "chunks": [],
            "metadata": {
                "source": unicodedata.normalize('NFC', source),
                "page": page,
                "total_pages": total_pages,
                "file_path": file_path
            }
        }
    pages_dict[page]["chunks"].append(d)

# Nối các chunk cùng trang lại để có văn bản đầy đủ của trang đó
pages_data = []
for p in sorted(pages_dict.keys()):
    full_page_text = "\n".join(pages_dict[p]["chunks"])
    # Loại bỏ các dòng lặp lại Header/Footer nếu còn sót
    lines = full_page_text.split('\n')
    cleaned_lines = [l for l in lines if "NCS.ThS.Lê Ngọc An" not in l and "Tài liệu tham khảo" not in l]
    cleaned_text = unicodedata.normalize('NFC', '\n'.join(cleaned_lines).strip())
    
    pages_data.append({
        "content": cleaned_text,
        "metadata": pages_dict[p]["metadata"]
    })

print(f"Đã tái tạo xong {len(pages_data)} trang nội dung sạch.")

# 2. Áp dụng thuật toán chunking mới: Structure-Aware (chunk_size=700, chunk_overlap=120)
new_chunks = chunk_document_pages(pages_data, chunk_size=700, chunk_overlap=120)
print(f"Số lượng chunk mới được tạo theo cấu trúc phân cấp: {len(new_chunks)}")

# 3. XÓA SẠCH VÀ NẠP LẠI VÀO CHROMADB
source_name = metas[0].get('source')
print(f"Đang xóa sạch dữ liệu cũ của: {source_name}...")
vs.delete_document(source_name)
# Đảm bảo xóa sạch cả tên đã chuẩn hóa
vs.delete_document(unicodedata.normalize('NFC', source_name))

print("Đang nạp dữ liệu vector mới vào ChromaDB...")
added = vs.add_documents(new_chunks)
print(f"Hoàn tất! Đã lập chỉ mục mới thành công: {added} chunks.")
