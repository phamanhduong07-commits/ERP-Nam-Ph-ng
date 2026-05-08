@echo off
title ERP Nam Phuong - Backend Server
chcp 65001 >nul

:: Kill any existing process on port 8000
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

cd /d "%~dp0backend"
set PYTHONIOENCODING=utf-8

:RESTART
echo [%date% %time%] Starting ERP Backend on port 8000...
"%~dp0backend\venv\Scripts\python.exe" run.py
echo [%date% %time%] Backend crashed or stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto RESTART
