import sys
import os

# Add the current directory to sys.path to import app modules
sys.path.append(os.getcwd())

from sqlalchemy import text
from app.database import engine

def create_indexes():
    indexes = [
        # Production Logs
        ("idx_prod_logs_machine_date", "production_logs", "(machine_id, created_at DESC)"),
        ("idx_prod_logs_order", "production_logs", "(production_order_id)"),
        
        # Inventory
        ("idx_inv_trans_wh_date", "inventory_transactions", "(warehouse_id, created_at DESC)"),
        ("idx_inv_bal_wh_prod", "inventory_balances", "(warehouse_id, product_id)"),
        ("idx_inv_bal_wh_paper", "inventory_balances", "(warehouse_id, paper_material_id)"),
        
        # Sales & Production Orders
        ("idx_so_items_order", "sales_order_items", "(order_id)"),
        ("idx_po_items_order", "production_order_items", "(production_order_id)"),
        
        # Scan Logs
        ("idx_scan_log_machine_date", "scan_log", "(may_scan_id, created_at DESC)"),
    ]

    with engine.connect() as conn:
        print("--- Checking and Creating Indexes ---")
        for idx_name, table_name, columns in indexes:
            try:
                # Check if index exists
                check_sql = text(f"SELECT 1 FROM pg_indexes WHERE indexname = '{idx_name}'")
                exists = conn.execute(check_sql).fetchone()
                
                if not exists:
                    print(f"Creating index {idx_name} on {table_name}...")
                    create_sql = text(f"CREATE INDEX {idx_name} ON {table_name} {columns}")
                    conn.execute(create_sql)
                    conn.commit()
                    print(f"DONE: Created {idx_name}")
                else:
                    print(f"SKIP: Index {idx_name} already exists.")
            except Exception as e:
                print(f"ERROR creating {idx_name}: {str(e)}")
        
        print("--- Optimization Completed ---")

if __name__ == "__main__":
    create_indexes()
