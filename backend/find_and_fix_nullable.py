import os
import re
import sys
from datetime import datetime, timezone
from sqlalchemy import create_engine, text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def extract_alter_calls(content):
    calls = []
    pos = 0
    while True:
        idx = content.find("op.alter_column", pos)
        if idx == -1:
            break
        start = content.find("(", idx)
        if start == -1:
            break
        count = 1
        i = start + 1
        while i < len(content) and count > 0:
            if content[i] == '(':
                count += 1
            elif content[i] == ')':
                count -= 1
            i += 1
        calls.append(content[idx:i])
        pos = idx + len("op.alter_column")
    return calls

def main():
    engine = create_engine(settings.DATABASE_URL)
    migration_path = "alembic/versions/0718ea571b91_add_incoming_invoices.py"
    
    with open(migration_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    alter_calls = extract_alter_calls(content)
    print(f"Parsed {len(alter_calls)} alter_column calls.")
    
    with engine.begin() as conn:
        for call in alter_calls:
            match = re.search(r"op\.alter_column\(\s*['\"]([^'\"]+)['\"]\s*,\s*['\"]([^'\"]+)['\"]", call)
            if not match:
                continue
                
            table_name, col_name = match.groups()
            
            # Check if nullable=False is set in this alter call
            # remove spaces and check for nullable=False
            call_no_spaces = call.replace(" ", "").replace("\n", "").replace("\r", "")
            if "nullable=False" in call_no_spaces:
                print(f"Checking {table_name}.{col_name} for NULL values (changing to NOT NULL)...")
                
                # Check for NULLs
                check_query = f"SELECT COUNT(*) FROM {table_name} WHERE {col_name} IS NULL"
                try:
                    null_count = conn.execute(text(check_query)).scalar()
                    if null_count > 0:
                        print(f"  Found {null_count} NULL values in {table_name}.{col_name}!")
                        
                        # Determine column type
                        type_query = """
                            SELECT data_type 
                            FROM information_schema.columns 
                            WHERE table_name = :table AND column_name = :col
                        """
                        col_type = conn.execute(text(type_query), {"table": table_name, "col": col_name}).scalar()
                        print(f"  Column type in DB: {col_type}")
                        
                        default_val = None
                        if col_type in ('integer', 'numeric', 'double precision', 'real', 'bigint', 'smallint'):
                            default_val = "0"
                        elif col_type == 'boolean':
                            default_val = "false"
                        elif col_type in ('character varying', 'text', 'character'):
                            default_val = "''"
                        elif col_type in ('timestamp without time zone', 'timestamp with time zone', 'date'):
                            default_val = "NOW()"
                            
                        if default_val is not None:
                            update_query = f"UPDATE {table_name} SET {col_name} = {default_val} WHERE {col_name} IS NULL"
                            conn.execute(text(update_query))
                            print(f"  Updated {null_count} NULL values to {default_val} in {table_name}.{col_name}")
                        else:
                            print(f"  [WARNING] Could not determine default value for type {col_type} on {table_name}.{col_name}")
                except Exception as e:
                    print(f"  Error checking/updating {table_name}.{col_name}: {e}")

if __name__ == "__main__":
    main()
