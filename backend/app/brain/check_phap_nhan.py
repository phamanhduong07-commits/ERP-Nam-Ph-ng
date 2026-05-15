from sqlalchemy import create_engine, text
import os

DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/namphuong_erp"
# Note: I should check the actual DB URL in app/config.py
engine = create_engine(DATABASE_URL)

with engine.connect() as conn:
    res = conn.execute(text("SELECT id, ma_phap_nhan, ten_phap_nhan, ten_viet_tat FROM phap_nhan"))
    for row in res:
        print(row)
