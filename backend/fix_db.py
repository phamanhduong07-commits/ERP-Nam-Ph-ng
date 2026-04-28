from app.database import engine
from sqlalchemy import text

with engine.connect() as con:
    with open('migrate_001.sql', encoding='utf-8') as f:
        sql = f.read()
    con.execute(text(sql))
    con.commit()
    print('Đã cập nhật Database thành công!')