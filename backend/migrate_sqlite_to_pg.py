"""
Migrate data from SQLite -> PostgreSQL
Run: python migrate_sqlite_to_pg.py
"""
import sqlite3
import sys
sys.path.insert(0, '.')
from app.database import engine
from sqlalchemy import text, inspect as sa_inspect

SQLITE_FILE = "erp_nam_phuong.db"

# Tables in dependency order (parents first)
TABLES = [
    "roles",
    "users",
    "customers",
    "suppliers",
    "warehouses",
    "material_groups",
    "paper_materials",
    "other_materials",
    "paper_rolls",
    "products",
    "quotes",
    "quote_items",
    "sales_orders",
    "sales_order_items",
    "production_orders",
    "production_order_items",
    "production_plans",
    "production_plan_lines",
    "production_boms",
    "production_bom_items",
    "production_bom_indirect_items",
    "indirect_cost_items",
    "inventory_balances",
    "inventory_transactions",
    "don_vi_tinh",
    "don_gia_van_chuyen",
    "phuong_xa",
    "tinh_thanh",
    "tai_xe",
    "xe",
    "vi_tri",
    "cau_truc_thong_dung",
    "audit_logs",
]


def get_sqlite_columns(cur, table):
    cur.execute(f"PRAGMA table_info({table})")
    return [row[1] for row in cur.fetchall()]


def get_pg_bool_columns(pg_conn, table):
    """Return set of boolean column names in PG table."""
    result = pg_conn.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = :t AND data_type = 'boolean'
    """), {"t": table})
    return {row[0] for row in result.fetchall()}


def convert_row(row_dict, bool_cols):
    """Convert SQLite int 0/1 to Python bool for boolean PG columns."""
    out = {}
    for k, v in row_dict.items():
        if k in bool_cols and isinstance(v, int):
            out[k] = bool(v)
        else:
            out[k] = v
    return out


def migrate_table(sqlite_cur, pg_conn, table):
    try:
        cols = get_sqlite_columns(sqlite_cur, table)
    except Exception as e:
        print(f"  [SKIP] {table}: cannot read columns — {e}")
        return 0

    sqlite_cur.execute(f"SELECT * FROM {table}")
    rows = sqlite_cur.fetchall()
    if not rows:
        print(f"  {table}: 0 rows (empty, skip)")
        return 0

    bool_cols = get_pg_bool_columns(pg_conn, table)

    col_str = ", ".join(f'"{c}"' for c in cols)
    val_str = ", ".join(f":{c}" for c in cols)
    sql = f'INSERT INTO {table} ({col_str}) VALUES ({val_str}) ON CONFLICT DO NOTHING'

    inserted = 0
    errors = 0
    for row in rows:
        raw = dict(zip(cols, row))
        row_dict = convert_row(raw, bool_cols)
        # Use a SAVEPOINT per row so one failure doesn't abort whole txn
        try:
            pg_conn.execute(text("SAVEPOINT sp_row"))
            pg_conn.execute(text(sql), row_dict)
            pg_conn.execute(text("RELEASE SAVEPOINT sp_row"))
            inserted += 1
        except Exception as e:
            pg_conn.execute(text("ROLLBACK TO SAVEPOINT sp_row"))
            pg_conn.execute(text("RELEASE SAVEPOINT sp_row"))
            errors += 1
            if errors <= 3:
                print(f"    [WARN] row {raw.get('id','?')}: {str(e)[:120]}")

    print(f"  {table}: {inserted} inserted, {errors} errors")
    return inserted


def reset_sequences(pg_conn, table):
    """Reset PG sequence after bulk insert."""
    try:
        pg_conn.execute(text(f"""
            SELECT setval(
                pg_get_serial_sequence('{table}', 'id'),
                COALESCE((SELECT MAX(id) FROM {table}), 1)
            )
        """))
    except Exception:
        pass


def main():
    sqlite_conn = sqlite3.connect(SQLITE_FILE)
    sqlite_cur = sqlite_conn.cursor()

    print(f"Migrating from {SQLITE_FILE} -> PostgreSQL")
    print("=" * 60)

    with engine.begin() as pg_conn:
        for table in TABLES:
            migrate_table(sqlite_cur, pg_conn, table)
            reset_sequences(pg_conn, table)

    sqlite_conn.close()
    print("=" * 60)
    print("Done!")


if __name__ == "__main__":
    main()
