@echo off
chcp 65001 >nul
echo ========================================================
echo    TRỢ LÝ HỌC TẬP THÔNG MINH (RAG LOCAL LLM)
echo    Frontend: React + Tailwind CSS (Port 3000)
echo    Backend:  FastAPI + ChromaDB (Port 8080)
echo ========================================================

set OLLAMA_MODELS=D:\ollama_models

echo [1/3] Đang khởi động Ollama...
start "Ollama Server" /B ollama serve

timeout /t 2 >nul

echo [2/3] Đang khởi động FastAPI Backend...
start "FastAPI Backend" cmd /k ".\venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8080"

timeout /t 2 >nul

echo [3/3] Đang khởi động React Frontend...
cd frontend
start "React Frontend" cmd /k "npm run dev -- --host 127.0.0.1 --port 3000"

echo ========================================================
echo HỆ THỐNG ĐÃ SẴN SÀNG!
echo Truy cập giao diện Web tại: http://127.0.0.1:3000
echo ========================================================
pause
