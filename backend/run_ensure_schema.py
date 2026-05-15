import os
import sys

# Add current dir to sys.path
sys.path.append(os.getcwd())

from app.database import engine, Base, ensure_schema
import app.models 

if __name__ == '__main__':
    print("Initializing new tables...")
    Base.metadata.create_all(bind=engine)
    print("Running ensure_schema...")
    ensure_schema()
    print("Done!")
