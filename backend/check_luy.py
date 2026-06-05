import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
os.chdir(os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

from database import engine
from sqlalchemy import text

q = "%luy%"
with engine.connect() as c:
    rows = c.execute(text("SELECT id, username, ho_ten, trang_thai FROM users WHERE ho_ten ILIKE :q"), {"q": q}).fetchall()
    for r in rows:
        print(r)
