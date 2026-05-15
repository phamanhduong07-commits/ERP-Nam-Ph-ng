from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    # Check constraints
    print("--- Constraints ---")
    rows = conn.execute(text("SELECT conname FROM pg_constraint WHERE conrelid = 'print_templates'::regclass")).fetchall()
    for row in rows:
        print(row[0])
    
    # Check indexes
    print("--- Indexes ---")
    rows = conn.execute(text("SELECT indexname FROM pg_indexes WHERE tablename = 'print_templates'")).fetchall()
    for row in rows:
        print(row[0])
