@echo off
chcp 65001 > nul
title Khoi dong SmartStudy RAG

echo ========================================================
echo        KHOI DONG HE THONG SMARTSTUDY RAG
echo ========================================================
echo.

:: 1. Khoi dong Ollama GPU
echo [1/3] Dang khoi dong Ollama phien ban GPU...
taskkill /F /IM "ollama*" >nul 2>&1
timeout /t 1 >nul
set "OLLAMA_MODELS=D:\ollama_models"
set "CUDA_VISIBLE_DEVICES=0"
start "Ollama Server (GPU)" cmd /k "title Ollama GPU Server && set OLLAMA_MODELS=D:\ollama_models && set CUDA_VISIBLE_DEVICES=0 && "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve"

timeout /t 3 >nul

:: 2. Khoi dong FastAPI Backend
echo [2/3] Dang khoi dong FastAPI Backend (Port 8080)...
start "Backend FastAPI (Port 8080)" cmd /k "title Backend FastAPI && cd /d "%~dp0" && .\venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8080 --reload"

timeout /t 2 >nul

:: 3. Khoi dong React Frontend
echo [3/3] Dang khoi dong React Frontend (Port 3000)...
start "Frontend Vite (Port 3000)" cmd /k "title Frontend Vite && cd /d "%~dp0frontend" && npm run dev -- --host 127.0.0.1 --port 3000"

echo.
echo ========================================================
echo  HOAN TAT! He thong dang chay tren:
echo  - Frontend: http://127.0.0.1:3000
echo  - Backend:  http://127.0.0.1:8080
echo ========================================================
pause
