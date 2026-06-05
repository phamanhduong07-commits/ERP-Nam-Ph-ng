import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))
os.chdir(os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()
from database import engine
from sqlalchemy import text

with engine.connect() as c:
    rows = c.execute(text("SELECT * FROM phan_xuong ORDER BY id LIMIT 30")).fetchall()
    cols = c.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='phan_xuong' ORDER BY ordinal_position")).fetchall()
    print("Cols:", [c[0] for c in cols])
    for r in rows:
        print(repr(r))
