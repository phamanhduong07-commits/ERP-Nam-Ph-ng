@echo off
d:
cd "d:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong\backend"
venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
pause
