import os
import sys
from datetime import date, datetime, timezone
from sqlalchemy import create_engine, text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def main():
    engine = create_engine(settings.DATABASE_URL)
    now = datetime.now(timezone.utc)
    today = date.today()
    
    with engine.begin() as conn:
        # 1. Check NOT NULL columns in quote_items
        not_null_cols_query = """
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'quote_items' AND is_nullable = 'NO'
        """
        cols = conn.execute(text(not_null_cols_query)).fetchall()
        print("NOT NULL columns in quote_items:")
        for col_name, data_type in cols:
            print(f"  {col_name} ({data_type})")
            
        # 2. Get or create a valid customer_id
        cust_res = conn.execute(text("SELECT id FROM customers LIMIT 1")).fetchone()
        if not cust_res:
            print("Error: No customers found in database.")
            return
        cust_id = cust_res[0]
        
        # 3. Get or create a valid quote
        quote_res = conn.execute(text("SELECT id FROM quotes LIMIT 1")).fetchone()
        if not quote_res:
            conn.execute(
                text("""
                    INSERT INTO quotes (id, so_bao_gia, ngay_bao_gia, customer_id, trang_thai, created_at, updated_at)
                    VALUES (1, 'DUMMY_Q_1', :ngay, :cust_id, 'moi', :created_at, :updated_at)
                """),
                {"ngay": today, "cust_id": cust_id, "created_at": now, "updated_at": now}
            )
            quote_id = 1
            print("Inserted dummy quote: id=1")
        else:
            quote_id = quote_res[0]
            print(f"Using existing quote: id={quote_id}")
            
        # 4. Insert dummy quote items 2 and 3 if they don't exist
        for item_id in (2, 3):
            item_res = conn.execute(text("SELECT id FROM quote_items WHERE id = :id"), {"id": item_id}).fetchone()
            if not item_res:
                insert_fields = {
                    "id": item_id,
                    "quote_id": quote_id,
                    "stt": 1,
                    "ten_hang": "Dummy Quote Item",
                    "so_luong": 1.0,
                    "dvt": "Thùng",
                    "so_lop": 3,
                    "so_mau": 0,
                    "lay_gia_moi_nl": False,
                    "khong_ct": False,
                    "co_tem_offset": False,
                    "tem_sp_per_to": 2,
                    "tem_waste_to": 150,
                    "tem_so_mau": 0,
                    "tem_co_can_mang": False,
                    "tem_co_khuon_be": False,
                    "tem_khuon_be_phan_bo": 10000,
                    "tem_co_uv": False,
                    "tem_co_suppo": False,
                    "tem_co_luoi": False,
                    "tem_hai_manh": False,
                    "tem_khac_thiet_ke": False,
                    "loai_in": "flexo",
                    "do_kho": False,
                    "ghim": False,
                    "chap_xa": False,
                    "do_phu": False,
                    "dan": False,
                    "boi": False,
                    "be_lo": False,
                    "co_be": False,
                    "be_hai_manh": False,
                    "gia_ban": 0.0,
                    "gia_phoi": 0.0,
                    "gia_noi_bo": 0.0
                }
                
                # Filter insert_fields to only those present in the actual NOT NULL columns
                actual_cols = [c[0] for c in cols]
                cols_to_insert = [c for c in actual_cols if c in insert_fields]
                
                # Build SQL statement
                fields_sql = ", ".join(cols_to_insert)
                placeholders_sql = ", ".join([f":{c}" for c in cols_to_insert])
                insert_sql = f"INSERT INTO quote_items ({fields_sql}) VALUES ({placeholders_sql})"
                
                params = {c: insert_fields[c] for c in cols_to_insert}
                conn.execute(text(insert_sql), params)
                print(f"Inserted dummy quote_item: id={item_id}")
                
    print("Dummy quote items creation completed!")

if __name__ == "__main__":
    main()
