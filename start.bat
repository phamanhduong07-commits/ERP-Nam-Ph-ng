@echo off
echo Starting ERP Nam Phuong...

start "Backend :8000" "%~dp0_start_backend.bat"
start "Frontend :5173" "%~dp0_start_frontend.bat"

ping -n 7 127.0.0.1 >nul
start http://localhost:5173
