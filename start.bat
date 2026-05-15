@echo off
title ERP Nam Phuong - Launcher
chcp 65001 >nul
echo.
echo ========================================
echo   ERP Nam Phuong - Khoi dong he thong
echo ========================================
echo.

:: Kill process cu tren ca 2 port
echo [1/3] Dang dung process cu...
powershell -NoProfile -Command "8001,5173 | ForEach-Object { Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } }"
timeout /t 2 /nobreak >nul

:: Mo backend (auto-restart loop)
echo [2/3] Khoi dong Backend :8001 ...
start "Backend :8001" "%~dp0start-backend.bat"

:: Mo frontend
echo [3/3] Khoi dong Frontend :5173 ...
start "Frontend :5173" "%~dp0_start_frontend.bat"

:: Cho backend san sang roi mo browser
echo.
echo Dang cho backend san sang (10 giay)...
timeout /t 10 /nobreak >nul
start http://localhost:5173

echo Xong! Backend: http://localhost:8001 | Frontend: http://localhost:5173
