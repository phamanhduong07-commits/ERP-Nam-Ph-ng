from app.database import engine
from sqlalchemy import inspect

inspector = inspect(engine)
cols = [c['name'] for c in inspector.get_columns('printer_user')]
print(f"Columns in printer_user: {cols}")
