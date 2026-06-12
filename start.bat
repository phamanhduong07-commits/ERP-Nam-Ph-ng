@echo off
title ERP Nam Phuong - Launcher
chcp 65001 >nul
echo.
echo ========================================
echo   ERP Nam Phuong - Khoi dong he thong
echo ========================================
echo.

:: Dung process cu tren port 8002 va 5173 neu co
echo [1/3] Dung process cu (neu co)...
powershell -NoProfile -Command "8002,5173 | ForEach-Object { $p = Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue; if ($p) { Stop-Process -Id $p.OwningProcess -Force -ErrorAction SilentlyContinue } }"
timeout /t 2 /nobreak >nul

:: Mo backend
echo [2/3] Khoi dong Backend (port 8002)...
start "ERP Backend :8002" cmd /k "cd /d "%~dp0backend" && set PORT=8002 && .\venv\Scripts\python.exe run.py"

:: Mo frontend
echo [3/3] Khoi dong Frontend (port 5173)...
start "ERP Frontend :5173" cmd /k "cd /d "%~dp0frontend" && npm run dev"

:: Cho san sang roi mo browser
echo.
echo Dang cho he thong khoi dong (12 giay)...
timeout /t 12 /nobreak >nul
start http://localhost:5173

echo.
echo Xong! Mo trinh duyet: http://localhost:5173
echo Dang nhap: admin / admin123
