@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
echo Stopping service...
sc stop NamPhuong-ERP >nul 2>&1
timeout /t 3 /nobreak >nul
echo Starting dev server with hot-reload...
set ERP_RELOAD=1
"D:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong\backend\venv\Scripts\python.exe" "D:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong\backend\run.py"
echo.
echo Dev server stopped. Restarting service...
sc start NamPhuong-ERP >nul 2>&1
pause
