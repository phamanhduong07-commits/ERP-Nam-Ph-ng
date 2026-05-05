from app.database import get_db
from sqlalchemy import text

db = next(get_db())
tables = ['customers', 'products', 'materials', 'warehouses']
for t in tables:
    try:
        result = db.execute(text(f'SELECT COUNT(*) FROM {t}')).fetchone()
        print(f'{t}: {result[0]}')
    except Exception as e:
        print(f'{t}: Error - {e}')