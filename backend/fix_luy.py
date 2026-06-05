import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
os.chdir(os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from database import engine
from sqlalchemy import text

with engine.connect() as c:
    rows = c.execute(text("SELECT id, username, ho_ten FROM users WHERE username = 'TRUONG_PHONG_SALE_ADMIN'")).fetchall()
    print("Found:", rows)
    if rows:
        c.execute(text("UPDATE users SET username = 'luy' WHERE username = 'TRUONG_PHONG_SALE_ADMIN'"))
        c.commit()
        print("Updated OK")
