from app.database import ensure_schema, engine
from sqlalchemy import text

def fix_schema():
    print("Running ensure_schema...")
    ensure_schema()
    
    # Check if production_plan_lines.thu_tu exists, if not add it manually just in case ensure_schema fails
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE production_plan_lines ADD COLUMN IF NOT EXISTS thu_tu INTEGER DEFAULT 0"))
            conn.commit()
            print("Ensured production_plan_lines.thu_tu exists.")
        except Exception as e:
            print(f"Error adding thu_tu: {e}")

if __name__ == "__main__":
    fix_schema()
