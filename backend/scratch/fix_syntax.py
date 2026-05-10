import os

file_path = 'app/routers/cd2.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken function definition
content = content.replace('def scan_history(\n    print("DEBUG: API scan-logs/history-list called"),\n', 'def scan_history(\n')

# Insert the print statement CORRECTLY inside the function body
old_line = '    from datetime import timedelta'
new_line = '    print("DEBUG: API scan-logs/history-list called")\n    from datetime import timedelta'
content = content.replace(old_line, new_line)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
print("SUCCESS: Syntax error fixed and debug print moved inside function body.")
