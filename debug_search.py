import sys
import unicodedata
from modules.vector_store import VectorStore

sys.stdout.reconfigure(encoding='utf-8')
vs = VectorStore()
query = unicodedata.normalize('NFC', "Khái niệm về kiến trúc phân tầng")
results = vs.similarity_search(query=query, top_k=5, min_score=0.0)
print(f"Total results: {len(results)}")
for idx, r in enumerate(results, 1):
    print(f"--- Chunk {idx} | Trang: {r['page']} | Score: {r['score']} ---")
    print(r['text'][:250])
    print()
