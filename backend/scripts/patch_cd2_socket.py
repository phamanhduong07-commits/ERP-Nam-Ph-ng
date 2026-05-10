import os

file_path = 'app/routers/cd2.py'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = []
for line in lines:
    new_lines.append(line)
    # Chèn sau db.commit() trong hàm move_phieu (khoảng dòng 795)
    if 'p.gio_hoan_thanh = datetime.utcnow()' in line:
        # Tìm dòng db.commit() tiếp theo
        pass
    if 'db.commit()' in line:
        # Kiểm tra ngữ cảnh để chèn đúng chỗ
        # Chỗ 1: move_phieu
        if 'p.sort_order = body.sort_order' in "".join(new_lines[-20:]):
            if 'await sio.emit("machine_status_update"' not in "".join(new_lines[-5:]):
                indent = line[:line.find('db.commit()')]
                new_lines.append(f'{indent}# Phat tin hieu WebSocket cho Dashboard\n')
                new_lines.append(f'{indent}await sio.emit("machine_status_update", {{\n')
                new_lines.append(f'{indent}    "machine_id": p.may_in_id,\n')
                new_lines.append(f'{indent}    "trang_thai": p.trang_thai,\n')
                new_lines.append(f'{indent}    "phieu_id": phieu_id\n')
                new_lines.append(f'{indent}}})\n')
        
        # Chỗ 2: track_production
        if 'p.so_luong_loi = (p.so_luong_loi or 0) + (data.quantity_loi or 0)' in "".join(new_lines[-10:]):
            if 'await sio.emit("machine_status_update"' not in "".join(new_lines[-5:]):
                indent = line[:line.find('db.commit()')]
                new_lines.append(f'{indent}# Phat tin hieu WebSocket cho Dashboard cap nhat tuc thi\n')
                new_lines.append(f'{indent}await sio.emit("machine_status_update", {{\n')
                new_lines.append(f'{indent}    "machine_id": data.machine_id,\n')
                new_lines.append(f'{indent}    "event_type": data.event_type,\n')
                new_lines.append(f'{indent}    "production_order_id": data.production_order_id,\n')
                new_lines.append(f'{indent}    "operator": current_user.ho_ten if current_user else "N/A"\n')
                new_lines.append(f'{indent}}})\n')

with open(file_path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Successfully patched cd2.py with WebSocket events.")
