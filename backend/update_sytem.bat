@echo off
title ERP - Cap nhat he thong
chcp 65001 >nul
echo.
echo ========================================
echo  CAP NHAT HE THONG ERP Nam Phuong
echo ========================================
echo.

:: 1. Pull code moi
echo [1/5] Keo code moi tu Git...
cd /d "%~dp0.."
git pull
if errorlevel 1 (
    echo CANH BAO: git pull that bai, tiep tuc voi code hien tai...
)

:: 2. Build frontend
echo.
echo [2/5] Build Frontend...
cd /d "%~dp0..\frontend"
call npm run build
if errorlevel 1 (
    echo LOI: Build frontend that bai! Dung lai.
    pause
    exit /b 1
)
echo OK: Frontend build thanh cong.

:: 3. Kill backend cu
echo.
echo [3/5] Dung backend cu...
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

:: 4. Chay alembic migration (neu co migration moi)
echo [4/5] Chay database migration...
cd /d "%~dp0"
set PYTHONIOENCODING=utf-8
python -m alembic upgrade head 2>nul
if errorlevel 1 (
    echo CANH BAO: Alembic migration co loi - kiem tra lai.
) else (
    echo OK: Database migration thanh cong.
)

:: 5. Khoi dong backend moi
echo.
echo [5/5] Khoi dong Backend moi...
echo       Backend chay tai: http://localhost:8000
echo       Nhan Ctrl+C de dung.
echo.
"C:\Users\USER\AppData\Local\Programs\Python\Python312\python.exe" run.py
pause
