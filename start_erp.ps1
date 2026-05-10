# ============================================================
# Start ERP Nam Phuong - port 8001
# Chay: Right-click -> Run with PowerShell (as Administrator)
# ============================================================

$BackendDir = "$PSScriptRoot\backend"
$LogFile    = "$PSScriptRoot\erp_server.log"

Write-Host "=== ERP Nam Phuong ===" -ForegroundColor Cyan
Write-Host "Backend : $BackendDir"
Write-Host "Log     : $LogFile"
Write-Host "URL     : http://localhost:8001"
Write-Host "Public  : https://erp.namphuongbaobi.com.vn"
Write-Host ""

Set-Location $BackendDir

# Kich hoat virtualenv neu co
if (Test-Path "$BackendDir\venv\Scripts\Activate.ps1") {
    & "$BackendDir\venv\Scripts\Activate.ps1"
    Write-Host "Virtualenv: OK" -ForegroundColor Green
} elseif (Test-Path "$PSScriptRoot\venv\Scripts\Activate.ps1") {
    & "$PSScriptRoot\venv\Scripts\Activate.ps1"
    Write-Host "Virtualenv: OK" -ForegroundColor Green
} else {
    Write-Host "Virtualenv: khong tim thay, dung Python he thong" -ForegroundColor Yellow
}

$Python = "$BackendDir\venv\Scripts\python.exe"
Write-Host "Khoi dong uvicorn port 8001..." -ForegroundColor Green
Write-Host "Python : $Python" -ForegroundColor Gray
& $Python -m uvicorn app.main:app --host 0.0.0.0 --port 8001 2>&1 | Tee-Object -FilePath $LogFile
