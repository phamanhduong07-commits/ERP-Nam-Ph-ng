$root = "d:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong"

Write-Host "Starting ERP Nam Phuong..." -ForegroundColor Cyan

# Backend
Start-Process cmd -ArgumentList "/k `"cd /d `"$root\backend`" && venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000`"" -WindowStyle Normal

# Frontend
Start-Process cmd -ArgumentList "/k `"cd /d `"$root\frontend`" && npm run dev -- --port 5173`"" -WindowStyle Normal

Write-Host "Cho server khoi dong (6 giay)..." -ForegroundColor Yellow
Start-Sleep -Seconds 6

Start-Process "http://localhost:5173"
Write-Host "Done! Mo http://localhost:5173" -ForegroundColor Green
