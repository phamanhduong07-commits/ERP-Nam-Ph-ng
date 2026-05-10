import os

file_path = 'app/routers/cd2.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace paths to be very unique and avoid any overlap
content = content.replace('@router.get("/scan/history")', '@router.get("/scan-logs/history-list")')
content = content.replace('@router.post("/scan/log", status_code=201)', '@router.post("/scan-logs/submit", status_code=201)')
content = content.replace('@router.delete("/scan/log/{log_id}")', '@router.delete("/scan-logs/delete/{log_id}")')

# Add debug print to confirm reload
if 'def scan_history(' in content:
    content = content.replace('def scan_history(', 'def scan_history(\n    print("DEBUG: API scan-logs/history-list called"),\n')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SUCCESS: Endpoints renamed and debug print added.")
