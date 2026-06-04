#Requires -RunAsAdministrator

$ServiceName = "NamPhuong-ERP-Frontend"
$WrapperBat  = "C:\nssm\start_erp_frontend.bat"
$CmdExe      = "C:\Windows\System32\cmd.exe"
$NssmExe     = "C:\nssm\nssm.exe"
$ProjectDir  = "D:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong\frontend"
$LogDir      = "D:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong\logs"

Write-Host "=== NamPhuong ERP Frontend - Service Installer ===" -ForegroundColor Cyan

# Stop + remove old
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    sc.exe stop $ServiceName 2>$null | Out-Null
    Start-Sleep -Seconds 3
    sc.exe delete $ServiceName 2>$null | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "Old service removed." -ForegroundColor Green
}

$conns = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    $conns | Select-Object -ExpandProperty OwningProcess | Select-Object -Unique | ForEach-Object {
        Write-Host "Killing PID $_"
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
}

$stillBound = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if ($stillBound) {
    Write-Host "ERROR: Port 5173 still occupied." -ForegroundColor Red
    pause; exit 1
}
Write-Host "Port 5173 is free." -ForegroundColor Green

# Register service
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

& $NssmExe install $ServiceName $CmdExe "/c $WrapperBat"
& $NssmExe set $ServiceName AppDirectory    $ProjectDir
& $NssmExe set $ServiceName AppStdout       "$LogDir\frontend.log"
& $NssmExe set $ServiceName AppStderr       "$LogDir\frontend_err.log"
& $NssmExe set $ServiceName AppRotateFiles  1
& $NssmExe set $ServiceName AppRotateBytes  10485760
& $NssmExe set $ServiceName Start           SERVICE_AUTO_START
& $NssmExe set $ServiceName AppRestartDelay 5000

Write-Host "Starting service..." -ForegroundColor Yellow
sc.exe start $ServiceName | Out-Null

$ok = $false
for ($i = 1; $i -le 30; $i++) {
    Start-Sleep -Seconds 1
    $code = & curl.exe -s -o NUL -w "%{http_code}" --max-time 2 http://127.0.0.1:5173 2>$null
    if ($code -eq "200" -or $code -eq "304") { $ok = $true; break }
    Write-Host "  [$i/30] waiting..." -ForegroundColor DarkGray
}

if ($ok) {
    Write-Host ""
    Write-Host "=== DONE ===" -ForegroundColor Green
    Write-Host "Frontend : http://localhost:5173" -ForegroundColor Green
    Write-Host "Service  : $ServiceName (auto-start on boot)" -ForegroundColor Green
} else {
    Write-Host "FAILED - frontend did not respond after 30s" -ForegroundColor Red
    Write-Host "Check logs: $LogDir\frontend_err.log" -ForegroundColor Red
}

pause
