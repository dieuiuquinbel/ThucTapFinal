import sys
import json
import time
import re
from typing import List, Dict, Any, Optional
import ollama

try:
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass


class LLMService:
    def __init__(
        self,
        primary_model: str = "qwen2.5:7b",
        fallback_model: str = "qwen2.5:3b",
        host: str = "http://localhost:11434",
        timeout: int = 180
    ):
        self.primary_model = primary_model
        self.fallback_model = fallback_model
        self.host = host
        self.timeout = timeout
        # Áp dụng timeout trực tiếp vào httpx client của ollama
        self.client = ollama.Client(host=self.host, timeout=self.timeout)
        self.active_model = self._select_best_available_model()

    def _get_installed_models(self) -> List[str]:
        try:
            res = self.client.list()
            models = []
            for m in res.get("models", []):
                name = m.get("name") or m.get("model", "")
                models.append(name.split(":")[0])
                models.append(name)
            return models
        except Exception:
            return []

    def _select_best_available_model(self) -> str:
        installed = self._get_installed_models()
        # Ưu tiên primary_model (qwen2.5:7b) -> fallback_model (qwen2.5:3b)
        candidates = [self.primary_model, self.fallback_model]
        for cand in candidates:
            cand_base = cand.split(":")[0]
            if cand in installed or cand_base in installed:
                return cand
        return self.primary_model

    def generate(
        self, 
        prompt: str, 
        system_prompt: Optional[str] = None, 
        temperature: float = 0.2,
        format: Optional[str] = None,
        max_tokens: int = 1024,
        num_ctx: int = 4096,
        preferred_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Tạo phản hồi với cơ chế Failover an toàn trên GPU 6GB: Qwen 2.5 7B -> Qwen 2.5 3B.
        Hỗ trợ preferred_model để chọn chế độ Siêu tốc (3B) hoặc Chuyên sâu (7B).
        """
        if preferred_model:
            models_to_try = [preferred_model]
            for m in [self.primary_model, self.fallback_model]:
                if m not in models_to_try:
                    models_to_try.append(m)
        else:
            self.active_model = self._select_best_available_model()
            models_to_try = [self.active_model]
            for m in [self.primary_model, self.fallback_model]:
                if m not in models_to_try:
                    models_to_try.append(m)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        last_error = None
        for model in models_to_try:
            try:
                start_time = time.time()
                chat_kwargs = {
                    "model": model,
                    "messages": messages,
                    "keep_alive": "30m",
                    "options": {
                        "temperature": temperature,
                        "num_ctx": num_ctx,
                        "num_predict": max_tokens,
                        "top_k": 20,
                        "top_p": 0.85,
                        "repeat_penalty": 1.18,
                        "num_batch": 256,
                    }
                }
                if format:
                    chat_kwargs["format"] = format

                response = self.client.chat(**chat_kwargs)
                elapsed = round(time.time() - start_time, 2)
                content = response["message"]["content"]
                
                self.active_model = model
                return {
                    "text": content,
                    "model_used": model,
                    "is_fallback": (model != self.primary_model),
                    "latency_sec": elapsed,
                    "success": True
                }
            except Exception as e:
                last_error = str(e)

        return {
            "text": f"Không thể kết nối đến cả 2 mô hình ({self.primary_model}, {self.fallback_model}). Chi tiết: {last_error}",
            "model_used": self.primary_model,
            "is_fallback": True,
            "latency_sec": 0,
            "success": False
        }

    def generate_stream(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        temperature: float = 0.2,
        max_tokens: int = 1024,
        num_ctx: int = 4096,
        preferred_model: Optional[str] = None
    ):
        """
        Streaming generation - yield từng token kèm tự động failover sang model dự phòng nếu model chính lỗi.
        Hỗ trợ preferred_model để chọn chế độ Siêu tốc (3B) hoặc Chuyên sâu (7B).
        """
        if preferred_model:
            models_to_try = [preferred_model]
            for m in [self.primary_model, self.fallback_model]:
                if m not in models_to_try:
                    models_to_try.append(m)
        else:
            self.active_model = self._select_best_available_model()
            models_to_try = [self.active_model]
            for m in [self.primary_model, self.fallback_model]:
                if m not in models_to_try:
                    models_to_try.append(m)

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        streamed_any = False
        last_error = None

        for model in models_to_try:
            try:
                stream = self.client.chat(
                    model=model,
                    messages=messages,
                    stream=True,
                    keep_alive="30m",
                    options={
                        "temperature": temperature,
                        "num_ctx": num_ctx,
                        "num_predict": max_tokens,
                        "top_k": 20,
                        "top_p": 0.85,
                        "repeat_penalty": 1.18,
                        "num_batch": 256,
                    }
                )
                self.active_model = model
                for chunk in stream:
                    token = chunk.get("message", {}).get("content", "")
                    if token:
                        streamed_any = True
                        yield token
                if streamed_any:
                    return
            except Exception as e:
                last_error = str(e)
                if streamed_any:
                    # Đang stream dở thì không thể fallback lại từ đầu token được
                    yield f"\n[Lỗi gián đoạn đường truyền: {e}]"
                    return

        yield f"Lỗi kết nối mô hình: {last_error}"

    def generate_json(
        self,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2048,
        num_ctx: int = 4096,
        preferred_model: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Sinh nội dung JSON tốc độ cao.
        """
        sys_p = (system_prompt or "") + "\nBạn BẮT BUỘC chỉ trả về chuỗi JSON hợp lệ, không giải thích dài dòng."
        res = self.generate(
            prompt=prompt, 
            system_prompt=sys_p, 
            temperature=0.1, 
            format="json", 
            max_tokens=max_tokens, 
            num_ctx=num_ctx,
            preferred_model=preferred_model
        )
        
        if not res["success"]:
            return {"data": None, "raw": res["text"], "success": False, "model_used": res["model_used"]}

        raw_text = res["text"].strip()
        json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', raw_text)
        if json_match:
            raw_text = json_match.group(1).strip()
            
        parsed = None
        try:
            parsed = json.loads(raw_text)
        except json.JSONDecodeError:
            # Cố gắng khôi phục JSON bị cắt đuôi token (ví dụ thiếu ']}' hoặc ']')
            last_brace = raw_text.rfind('}')
            if last_brace != -1:
                for suffix in ["\n]}", "\n]", "\n}"]:
                    try:
                        fixed_text = raw_text[:last_brace + 1] + suffix
                        parsed = json.loads(fixed_text)
                        break
                    except Exception:
                        continue

        if parsed is not None:
            if isinstance(parsed, dict):
                for k in ["questions", "quiz", "data", "cards", "flashcards"]:
                    if k in parsed and isinstance(parsed[k], list):
                        parsed = parsed[k]
                        break
                if isinstance(parsed, dict) and "id" in parsed:
                    parsed = [parsed]
            return {
                "data": parsed,
                "raw": raw_text,
                "success": True,
                "model_used": res["model_used"],
                "latency_sec": res["latency_sec"]
            }
        else:
            return {
                "data": None,
                "raw": raw_text,
                "error": "Lỗi phân tích JSON từ mô hình",
                "success": False,
                "model_used": res["model_used"]
            }
