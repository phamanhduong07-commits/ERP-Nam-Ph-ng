#!/usr/bin/env python
"""
Script để reset và chạy lại migration
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import engine
import sqlalchemy

def reset_and_migrate():
    """Reset các bảng permissions và chạy lại migration"""
    
    print("🗑️  Dropping existing tables...")
    with engine.connect() as conn:
        try:
            conn.execute(sqlalchemy.text("DROP TABLE IF EXISTS role_permissions CASCADE;"))
            conn.execute(sqlalchemy.text("DROP TABLE IF EXISTS permissions CASCADE;"))
            conn.commit()
            print("✅ Tables dropped successfully")
        except Exception as e:
            print(f"⚠️  Warning: {e}")
    
    print("\n📝 Running migration...")
    
    # Read migration file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    migration_file = os.path.join(script_dir, "..", "database", "migrate_006_permissions.sql")
    
    if not os.path.exists(migration_file):
        print(f"❌ Migration file not found: {migration_file}")
        sys.exit(1)
    
    with open(migration_file, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    # Parse statements
    statements = []
    current = []
    
    for line in sql.split('\n'):
        stripped = line.strip()
        
        if not stripped or stripped.startswith('--'):
            if current:
                current.append(line)
            continue
        
        current.append(line)
        
        if stripped.endswith(';'):
            statements.append('\n'.join(current))
            current = []
    
    if current:
        statements.append('\n'.join(current))
    
    # Execute statements
    with engine.connect() as conn:
        for i, stmt in enumerate(statements):
            stmt = stmt.strip()
            if not stmt or stmt.startswith('--'):
                continue
            
            if stmt.endswith(';'):
                stmt = stmt[:-1]
            
            try:
                preview = stmt.replace('\n', ' ')[:80]
                print(f"[{i+1}] {preview}...")
                conn.execute(sqlalchemy.text(stmt))
                conn.commit()
                print(f"     ✅ OK")
            except Exception as e:
                print(f"     ❌ {str(e)[:100]}")
                conn.rollback()
    
    print("\n✅ Migration completed!")

if __name__ == "__main__":
    reset_and_migrate()
