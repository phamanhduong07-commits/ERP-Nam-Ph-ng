from app.database import engine
from sqlalchemy import inspect

inspector = inspect(engine)
cols = [c['name'] for c in inspector.get_columns('users')]
print(f"Columns in users: {cols}")
