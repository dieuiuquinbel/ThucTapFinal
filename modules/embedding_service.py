import ollama
import logging
from typing import List
from concurrent.futures import ThreadPoolExecutor, as_completed
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

logger = logging.getLogger(__name__)


class EmbeddingService(EmbeddingFunction):
    def __init__(self, model_name: str = "bge-m3", host: str = "http://localhost:11434"):
        self.model_name = model_name
        self.host = host
        self.client = ollama.Client(host=self.host)

    def name(self) -> str:
        return f"ollama_{self.model_name}"

    def get_embedding(self, text: str) -> List[float]:
        """
        Nhúng 1 chuỗi văn bản thành vector.
        """
        response = self.client.embeddings(model=self.model_name, prompt=text)
        return response["embedding"]

    def _embed_single(self, text: str) -> List[float]:
        """Gọi Ollama embed cho 1 text (dùng trong thread pool)."""
        res = self.client.embeddings(model=self.model_name, prompt=text)
        return res["embedding"]

    def __call__(self, input: Documents) -> Embeddings:
        """
        Interface chuẩn theo ChromaDB EmbeddingFunction.
        Dùng ThreadPoolExecutor để nhúng song song tối đa 4 chunk cùng lúc,
        giảm thời gian embedding từ N*2s xuống còn ~N/4 * 2s.
        """
        n = len(input)
        if n == 0:
            return []

        if n == 1:
            return [self._embed_single(input[0])]

        # Song song hóa embedding - Ollama xử lý được nhiều request đồng thời
        # max_workers=4 để không quá tải Ollama trên GPU 6GB
        results = [None] * n
        max_workers = min(4, n)
        
        logger.info(f"[Embedding] Bắt đầu nhúng {n} chunks với {max_workers} luồng song song...")

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_idx = {
                executor.submit(self._embed_single, input[i]): i
                for i in range(n)
            }
            done_count = 0
            for future in as_completed(future_to_idx):
                idx = future_to_idx[future]
                try:
                    results[idx] = future.result(timeout=30)
                    done_count += 1
                    if done_count % 5 == 0 or done_count == n:
                        logger.info(f"[Embedding] Đã nhúng {done_count}/{n} chunks")
                except Exception as e:
                    logger.error(f"[Embedding] Lỗi chunk {idx}: {e}")
                    # Fallback: thử lại 1 lần
                    try:
                        results[idx] = self._embed_single(input[idx])
                    except Exception:
                        raise RuntimeError(f"Không thể nhúng vector cho chunk {idx}: {e}")

        return results

