# ============================================================
# UPDATE ERP Nam Phuong
# Double-click hoac chay: .\update.ps1
# ============================================================

$Root    = $PSScriptRoot
$Frontend = "$Root\frontend"
$Backend  = "$Root\backend"

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  UPDATE ERP NAM PHUONG" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# --- 1. Build frontend ---
Write-Host "[1/3] Build frontend..." -ForegroundColor Yellow
Set-Location $Frontend
$buildResult = npx vite build 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARN: Build co canh bao nhung van tiep tuc" -ForegroundColor Yellow
}
Write-Host "      Build xong -> backend\dist\" -ForegroundColor Green

# --- 2. Sync schema DB (them cot neu co model moi) ---
Write-Host "[2/3] Sync database schema..." -ForegroundColor Yellow
Set-Location $Backend
$dbScript = @'
from app.database import engine, Base, ensure_schema, _sync_all_tables
_sync_all_tables(Base, engine)
ensure_schema()
print("Schema OK")
'@
$dbResult = $dbScript | & "venv\Scripts\python.exe" 2>&1
Write-Host "      $($dbResult | Select-Object -Last 1)" -ForegroundColor Green

# --- 3. Restart uvicorn ---
Write-Host "[3/3] Restart backend (port 8001)..." -ForegroundColor Yellow
Stop-Process -Name python -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$Backend'; Write-Host 'ERP Backend - Port 8001' -ForegroundColor Cyan; & 'venv\Scripts\python.exe' -m uvicorn app.main:app --host 0.0.0.0 --port 8001"
) -WindowStyle Normal

Start-Sleep -Seconds 5

# Kiem tra
$check = netstat -ano 2>$null | Select-String ":8001"
if ($check) {
    Write-Host "      Backend dang chay port 8001 OK" -ForegroundColor Green
} else {
    Write-Host "      WARN: Chua thay port 8001, kiem tra cua so uvicorn" -ForegroundColor Red
}

Write-Host ""
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  HOAN THANH! https://erp.namphuongbaobi.com.vn" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Nhan Enter de dong"
