@echo off
title ERP - Restart Backend
chcp 65001 >nul
echo.
echo ========================================
echo  RESTART BACKEND ERP Nam Phuong
echo ========================================
echo.

:: 1. Kill process dang chiem port 8000
echo [1/3] Dang dung backend cu...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

:: 2. Kiem tra port da free chua
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue) { Write-Host 'WARNING: Port 8000 van con bi chiem!' -ForegroundColor Yellow } else { Write-Host 'OK: Port 8000 da free.' -ForegroundColor Green }"

:: 3. Khoi dong lai backend voi code moi
echo [2/3] Dang khoi dong backend moi...
cd /d "%~dp0backend"
set PYTHONIOENCODING=utf-8

echo [3/3] Backend dang chay tai http://localhost:8000
echo       Nhan Ctrl+C de dung.
echo.
"%~dp0backend\venv\Scripts\python.exe" run.py
pause
