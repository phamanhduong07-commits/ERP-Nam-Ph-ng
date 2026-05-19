from sqlalchemy import create_engine, text
import sys

sys.stdout.reconfigure(encoding='utf-8')

# Import settings from app.config
try:
    from app.config import settings
    db_url = settings.DATABASE_URL
    print("Database URL from config:", db_url)
except Exception as e:
    print("Error importing settings:", e)
    db_url = "postgresql://postgres:postgres@localhost:5432/erp" # default fallback
    
try:
    engine = create_engine(db_url)
    with engine.connect() as conn:
        print("\nConnection to database successful!")
        
        # Check active tables
        res = conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema='public'"))
        tables = [row[0] for row in res]
        print("\nTables in database:")
        print(tables)
        
        # Count rows in key tables
        for table in ['customers', 'products', 'sales_orders', 'sales_order_items', 'quotes', 'quote_items']:
            if table in tables:
                cnt = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
                print(f"Row count in '{table}': {cnt}")
                
        # Check a sample of customers
        if 'customers' in tables:
            res_cust = conn.execute(text("SELECT id, ma_kh, ten_viet_tat FROM customers LIMIT 5")).fetchall()
            print("\nSample Customers in DB:")
            for r in res_cust:
                print(r)
                
except Exception as e:
    print("Database error:", e)
