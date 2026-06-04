@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "D:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong"

echo [1/4] Pulling latest code...
git pull

echo [2/4] Installing backend dependencies...
"backend\venv\Scripts\pip.exe" install -r backend\requirements.txt -q

echo [3/4] Building frontend...
cd frontend
node_modules\.bin\vite.cmd build
cd ..

echo [4/4] Restarting services...
sc stop NamPhuong-ERP >nul 2>&1
sc stop NamPhuong-ERP-Frontend >nul 2>&1
timeout /t 3 /nobreak >nul
sc start NamPhuong-ERP >nul 2>&1
sc start NamPhuong-ERP-Frontend >nul 2>&1
timeout /t 8 /nobreak >nul

curl -s http://127.0.0.1:8001/health
echo.
curl -s -o nul -w "Frontend: %%{http_code}" http://127.0.0.1:5173
echo.
echo Deploy done.
pause
