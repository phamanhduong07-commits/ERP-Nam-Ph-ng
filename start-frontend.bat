@echo off
title ERP Nam Phuong - Frontend Dev Server
chcp 65001 >nul

:: Kill any existing process on port 5174
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5174 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
timeout /t 2 /nobreak >nul

cd /d "%~dp0frontend"

:: Clear Vite cache to avoid EPERM on restart
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"

:RESTART
echo [%date% %time%] Starting ERP Frontend on port 5174...
npm run dev -- --host 0.0.0.0 --port 5174
echo [%date% %time%] Frontend stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
if exist "node_modules\.vite" rmdir /s /q "node_modules\.vite"
goto RESTART
