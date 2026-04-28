from app.database import engine
from sqlalchemy import text

queries = [
    # 1. Backfill POI spec
    """
    UPDATE production_order_items poi
    SET loai_thung = COALESCE(poi.loai_thung, soi.loai_thung),
        dai = COALESCE(poi.dai, soi.dai),
        rong = COALESCE(poi.rong, soi.rong),
        cao = COALESCE(poi.cao, soi.cao)
    FROM sales_order_items soi
    WHERE poi.sales_order_item_id = soi.id;
    """,
    # 2. Backfill c_tham/can_man
    """
    UPDATE production_order_items poi
    SET c_tham = COALESCE(poi.c_tham, qi.c_tham),
        can_man = COALESCE(poi.can_man, qi.can_man)
    FROM sales_order_items soi, quote_items qi
    WHERE poi.sales_order_item_id = soi.id 
      AND soi.quote_item_id = qi.id;
    """,
    # 3. Backfill quote_item_id cho sales_order_items
    """
    UPDATE sales_order_items soi
    SET quote_item_id = qi.id
    FROM sales_orders so, quotes q, quote_items qi
    WHERE soi.order_id = so.id
      AND so.ghi_chu LIKE 'Lập từ báo giá ' || q.so_bao_gia || '%%'
      AND qi.quote_id = q.id
      AND qi.product_id = soi.product_id
      AND soi.quote_item_id IS NULL;
    """
]

with engine.connect() as con:
    for q in queries:
        try:
            con.execute(text(q))
            con.commit()
            print("Đã cập nhật xong một phần dữ liệu...")
        except Exception as e:
            print(f"Lỗi tại truy vấn: {e}")
    print("--- HOÀN TẤT CẬP NHẬT DỮ LIỆU ---")