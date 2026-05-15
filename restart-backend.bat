@echo off
title ERP - Restart Backend
chcp 65001 >nul
echo.
echo ========================================
echo   RESTART BACKEND ERP Nam Phuong
echo ========================================
echo.

:: 1. Kill process dang chiem port 8001
echo [1/3] Dang dung backend cu...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

:: 2. Kiem tra port da free chua
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue) { Write-Host 'WARNING: Port 8001 van con bi chiem!' -ForegroundColor Yellow } else { Write-Host 'OK: Port 8001 da free.' -ForegroundColor Green }"

:: 3. Khoi dong lai
echo [2/3] Khoi dong backend moi tren port 8001...
cd /d "%~dp0backend"
set PYTHONIOENCODING=utf-8
set PORT=8001
set ERP_RELOAD=1

echo [3/3] Backend dang chay tai http://localhost:8001
echo       Nhan Ctrl+C de dung.
echo.
"%~dp0backend\venv\Scripts\python.exe" run.py
pause
