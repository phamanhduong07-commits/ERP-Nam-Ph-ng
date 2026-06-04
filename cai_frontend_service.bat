@echo off
net session >nul 2>&1
if %errorLevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)
powershell -NoExit -ExecutionPolicy Bypass -File "%~dp0install_frontend_service.ps1"
