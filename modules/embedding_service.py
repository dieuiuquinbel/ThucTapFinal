import os
import math
import re
import ollama
import logging
from typing import List
from chromadb.api.types import Documents, EmbeddingFunction, Embeddings

# Tắt Flash Attention để tránh lỗi tràn số F16 / vector NaN của bge-m3 trên llama.cpp
os.environ["OLLAMA_FLASH_ATTENTION"] = "false"

logger = logging.getLogger(__name__)


def is_valid_vector(vec: List[float]) -> bool:
    """Kiểm tra vector có chứa giá trị NaN hoặc Inf không."""
    if not vec or not isinstance(vec, list):
        return False
    for val in vec:
        if val is None or math.isnan(val) or math.isinf(val):
            return False
    return True


def sanitize_vector(vec: List[float], target_dim: int = 1024) -> List[float]:
    """Thay thế các giá trị NaN/Inf bằng 0.0 để bảo vệ ChromaDB."""
    if not vec:
        return [0.0] * target_dim
    cleaned = []
    for val in vec:
        if val is None or math.isnan(val) or math.isinf(val):
            cleaned.append(0.0)
        else:
            cleaned.append(float(val))
    return cleaned


class EmbeddingService(EmbeddingFunction):
    def __init__(self, model_name: str = "bge-m3", host: str = "http://localhost:11434"):
        self.model_name = model_name
        self.host = host
        self.client = ollama.Client(host=self.host)
        self.target_dim = 1024 if "bge-m3" in model_name else 768

    def name(self) -> str:
        return f"ollama_{self.model_name}"

    def _sanitize_text_for_embedding(self, text: str) -> str:
        """Làm sạch văn bản, loại bỏ các chuỗi ký tự điều khiển có thể gây overflow."""
        if not text:
            return " "
        # Bỏ ký tự điều khiển ASCII
        cleaned = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', ' ', text)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        # Cắt tối đa 3500 ký tự để tránh tràn ngữ cảnh bge-m3
        return cleaned[:3500] if len(cleaned) > 3500 else cleaned

    def _embed_single(self, text: str) -> List[float]:
        """Gọi Ollama embed cho 1 chuỗi văn bản và kiểm tra triệt để lỗi NaN."""
        safe_text = self._sanitize_text_for_embedding(text)
        try:
            res = self.client.embeddings(model=self.model_name, prompt=safe_text, keep_alive="30m")
            vec = res.get("embedding", [])
            
            # Kiểm tra lỗi NaN của bge-m3
            if is_valid_vector(vec):
                return vec
                
            logger.warning(f"[Embedding] Phát hiện vector chứa NaN từ {self.model_name}! Đang khử nhiễu...")
            # Thử lại với text tối giản
            ultra_clean = re.sub(r'[^\w\s.,;:?!()-]', ' ', safe_text)
            res_retry = self.client.embeddings(model=self.model_name, prompt=ultra_clean[:1500], keep_alive="30m")
            vec_retry = res_retry.get("embedding", [])
            if is_valid_vector(vec_retry):
                return vec_retry

            logger.error("[Embedding] Vector vẫn chứa NaN sau khi thử lại. Khử NaN bằng 0.0 để bảo vệ ChromaDB.")
            return sanitize_vector(vec_retry or vec, target_dim=self.target_dim)
        except Exception as e:
            logger.error(f"[Embedding] Lỗi khi gọi Ollama embeddings: {e}")
            # Thử lại 1 lần
            try:
                res = self.client.embeddings(model=self.model_name, prompt=safe_text[:1000], keep_alive="30m")
                vec = res.get("embedding", [])
                return sanitize_vector(vec, target_dim=self.target_dim)
            except Exception as e2:
                logger.error(f"[Embedding] Thất bại lần 2: {e2}")
                return [0.0] * self.target_dim

    def get_embedding(self, text: str) -> List[float]:
        """Nhúng 1 chuỗi văn bản thành vector."""
        return self._embed_single(text)

    def __call__(self, input: Documents) -> Embeddings:
        """
        Interface chuẩn theo ChromaDB EmbeddingFunction.
        Xử lý tuần tự có kiểm soát (Sequential Processing) để tránh tranh chấp hàng đợi
        và nghẽn inference trên Ollama (vốn chạy đơn luồng trên GPU).
        """
        n = len(input)
        if n == 0:
            return []

        logger.info(f"[Embedding] Bắt đầu nhúng tuần tự {n} chunks qua {self.model_name}...")
        results = []
        for idx, text in enumerate(input):
            vec = self._embed_single(text)
            results.append(vec)
            if (idx + 1) % 5 == 0 or (idx + 1) == n:
                logger.info(f"[Embedding] Tiến độ: {idx + 1}/{n} chunks hoàn tất")

        return results
