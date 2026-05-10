from app.database import SessionLocal
from sqlalchemy import text

db = SessionLocal()
try:
    res = db.execute(text('SELECT token_user, machine_id FROM printer_user'))
    print("Worker-Machine Links:")
    for r in res:
        print(f"User: {r[0]}, MachineID: {r[1]}")
except Exception as e:
    print(f"Error: {str(e)}")
finally:
    db.close()
