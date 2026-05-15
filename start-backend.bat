@echo off
title ERP Nam Phuong - Backend :8001
chcp 65001 >nul

:: Kill process dang chiem port 8001
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

cd /d "%~dp0backend"
set PYTHONIOENCODING=utf-8
set PORT=8001
:: Bo comment dong duoi de bat hot-reload (dev mode):
:: set ERP_RELOAD=1

:RESTART
echo [%date% %time%] Starting ERP Backend on port 8001...
"%~dp0backend\venv\Scripts\python.exe" run.py
echo [%date% %time%] Backend stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto RESTART
