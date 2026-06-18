import os
import sys
from sqlalchemy import create_engine, text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL)
    with engine.begin() as conn:
        print("Truncating other_materials.ma_amis to 50 chars...")
        res = conn.execute(text("""
            UPDATE other_materials 
            SET ma_amis = LEFT(ma_amis, 50)
            WHERE ma_amis IS NOT NULL AND LENGTH(ma_amis) > 50;
        """))
        print(f"Updated {res.rowcount} records.")

if __name__ == "__main__":
    main()
