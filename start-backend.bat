@echo off
title ERP Nam Phuong - Backend Server

:: Kill any existing process on port 8000 (PowerShell for reliability)
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

:RESTART
echo [%date% %time%] Starting ERP Backend on port 8000...
"C:\Users\USER\AppData\Local\Programs\Python\Python312\python.exe" "C:\Users\USER\Desktop\D%u1eef LI%u1ec6U MPS\erp-nam-phuong\backend\run.py"
echo [%date% %time%] Backend crashed or stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto RESTART
