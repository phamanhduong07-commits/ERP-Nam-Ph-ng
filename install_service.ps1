#Requires -RunAsAdministrator

$ServiceName = "NamPhuong-ERP"
$ProjectDir  = "D:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong\backend"
$WrapperBat  = "C:\nssm\start_erp.bat"
$CmdExe      = "C:\Windows\System32\cmd.exe"
$NssmDir     = "C:\nssm"
$NssmExe     = "$NssmDir\nssm.exe"
$LogDir      = "$ProjectDir\logs"

Write-Host "=== NamPhuong ERP - Service Installer ===" -ForegroundColor Cyan

# 1. Check NSSM
if (-not (Test-Path $NssmExe)) {
    Write-Host "[1/4] Downloading NSSM..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Force -Path $NssmDir | Out-Null
    $zip = "$env:TEMP\nssm.zip"
    Invoke-WebRequest "https://nssm.cc/release/nssm-2.24.zip" -OutFile $zip -UseBasicParsing
    Add-Type -Assembly "System.IO.Compression.FileSystem"
    $extracted = "$env:TEMP\nssm_extracted"
    if (Test-Path $extracted) { Remove-Item $extracted -Recurse -Force }
    [System.IO.Compression.ZipFile]::ExtractToDirectory($zip, $extracted)
    Copy-Item "$extracted\nssm-2.24\win64\nssm.exe" $NssmExe -Force
    Remove-Item $zip, $extracted -Recurse -Force
    Write-Host "    NSSM installed: $NssmExe" -ForegroundColor Green
} else {
    Write-Host "[1/4] NSSM already exists: $NssmExe" -ForegroundColor Green
}

# 2. Stop + remove old service and clear port 8001
Write-Host "[2/4] Removing old service and clearing port 8001..." -ForegroundColor Yellow
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    sc.exe stop $ServiceName 2>$null | Out-Null
    Start-Sleep -Seconds 3
    sc.exe delete $ServiceName 2>$null | Out-Null
    Start-Sleep -Seconds 2
    Write-Host "    Service removed." -ForegroundColor Green
}

$conns = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    $conns | Select-Object -ExpandProperty OwningProcess | Select-Object -Unique | ForEach-Object {
        Write-Host "    Killing PID $_"
        Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 3
}

$stillBound = Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue
if ($stillBound) {
    Write-Host "    ERROR: Port 8001 still occupied by PID $($stillBound.OwningProcess)" -ForegroundColor Red
    pause; exit 1
}
Write-Host "    Port 8001 is free." -ForegroundColor Green

# 3. Register service
Write-Host "[3/4] Registering service..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

& $NssmExe install $ServiceName $CmdExe "/c $WrapperBat"
& $NssmExe set $ServiceName AppDirectory    $ProjectDir
& $NssmExe set $ServiceName AppStdout       "$LogDir\server.log"
& $NssmExe set $ServiceName AppStderr       "$LogDir\server_err.log"
& $NssmExe set $ServiceName AppRotateFiles  1
& $NssmExe set $ServiceName AppRotateBytes  10485760
& $NssmExe set $ServiceName Start           SERVICE_AUTO_START
& $NssmExe set $ServiceName AppRestartDelay 5000

# 4. Start and verify
Write-Host "[4/4] Starting service..." -ForegroundColor Yellow
sc.exe start $ServiceName | Out-Null

$ok = $false
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Seconds 1
    $code = & curl.exe -s -o NUL -w "%{http_code}" --max-time 2 http://127.0.0.1:8001/health 2>$null
    if ($code -eq "200") { $ok = $true; break }
    Write-Host "    [$i/15] waiting..." -ForegroundColor DarkGray
}

if ($ok) {
    Write-Host ""
    Write-Host "=== DONE ===" -ForegroundColor Green
    Write-Host "Server  : http://localhost:8001  ->  OK" -ForegroundColor Green
    Write-Host "Service : $ServiceName (auto-start on boot)" -ForegroundColor Green
    Write-Host "Logs    : $LogDir" -ForegroundColor Green
    Write-Host ""
    Write-Host "Commands:" -ForegroundColor Cyan
    Write-Host "  Restart : Restart-Service $ServiceName"
    Write-Host "  Stop    : Stop-Service $ServiceName"
    Write-Host "  Log     : Get-Content $LogDir\server.log -Tail 50 -Wait"
} else {
    Write-Host "FAILED - server did not respond after 15s" -ForegroundColor Red
    Write-Host "Check logs at $LogDir" -ForegroundColor Red
}

pause
