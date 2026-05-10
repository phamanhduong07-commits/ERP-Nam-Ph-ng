import sqlite3, psycopg2

# Lấy groups từ SQLite cũ
try:
    sq = sqlite3.connect(r'd:\NAM_PHUONG_SOFTWARE\DU LIEU MPS\erp-nam-phuong\backend\erp_nam_phuong.db')
    cur_sq = sq.cursor()
    cur_sq.execute("SELECT name FROM sqlite_master WHERE type='table'")
    print('SQLite tables:', [r[0] for r in cur_sq.fetchall()])
    try:
        cur_sq.execute("SELECT id, ma_nhom, ten_nhom, la_nhom_giay, bo_phan, phan_xuong FROM material_groups")
        groups = cur_sq.fetchall()
        print('Groups from SQLite:', groups)
    except Exception as e:
        print('No material_groups in SQLite:', e)
    sq.close()
except Exception as e:
    print('SQLite error:', e)
