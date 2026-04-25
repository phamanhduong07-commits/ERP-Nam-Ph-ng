@echo off
title ERP Nam Phuong - Backend Server

:: Kill any existing backend process on port 8000
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F 2>nul
)
timeout /t 1 /nobreak >nul

cd /d "C:\Users\USER\Desktop\DỮ LIỆU MPS\erp-nam-phuong\backend"

:RESTART
echo [%date% %time%] Starting ERP Backend on port 8000...
"C:\Users\USER\AppData\Local\Programs\Python\Python312\python.exe" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --log-level info
echo [%date% %time%] Backend crashed or stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto RESTART
