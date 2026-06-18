import os
import sys
from sqlalchemy import create_engine, text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL)
    with engine.connect() as conn:
        query = """
            SELECT id, ma_chinh, ma_amis, LENGTH(ma_amis)
            FROM other_materials
            WHERE ma_amis IS NOT NULL AND LENGTH(ma_amis) > 50
        """
        res = conn.execute(text(query)).fetchall()
        print(f"Found {len(res)} records with ma_amis > 50 chars:")
        for r in res:
            ma_chinh_safe = str(r[1]).encode('ascii', errors='replace').decode('ascii')
            ma_amis_safe = str(r[2]).encode('ascii', errors='replace').decode('ascii')
            print(f"ID: {r[0]}, ma_chinh: {ma_chinh_safe}, len: {r[3]}, ma_amis: {ma_amis_safe}")

if __name__ == "__main__":
    main()
