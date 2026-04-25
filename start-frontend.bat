@echo off
title ERP Nam Phuong - Frontend Dev Server

cd /d "C:\Users\USER\Desktop\DỮ LIỆU MPS\erp-nam-phuong\frontend"

:RESTART
echo [%date% %time%] Starting ERP Frontend on port 5174...
npm run dev
echo [%date% %time%] Frontend stopped. Restarting in 3 seconds...
timeout /t 3 /nobreak >nul
goto RESTART
