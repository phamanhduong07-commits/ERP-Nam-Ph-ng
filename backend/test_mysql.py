import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.database import Base, engine
from app.models import *  # load all models

print("Creating tables in MySQL...")
Base.metadata.create_all(bind=engine)
print("OK! All tables created.")

# Count tables
from sqlalchemy import inspect, text
with engine.connect() as conn:
    result = conn.execute(text("SHOW TABLES"))
    tables = [r[0] for r in result]
    print(f"Tables ({len(tables)}): {tables}")
