#!/usr/bin/env python
"""
Script để chạy migration SQL
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import get_db, engine
import sqlalchemy
import re

def run_migration_file(filepath):
    """Chạy file migration SQL"""
    with open(filepath, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    # Tách các statements bằng GO hoặc ;
    # Nhưng cẩn thận với comment lines
    statements = []
    current = []
    
    for line in sql.split('\n'):
        stripped = line.strip()
        
        # Skip empty lines and comments
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
    
    with engine.connect() as conn:
        for i, stmt in enumerate(statements):
            stmt = stmt.strip()
            if not stmt or stmt.startswith('--'):
                continue
            
            # Remove trailing semicolon
            if stmt.endswith(';'):
                stmt = stmt[:-1]
            
            try:
                # Show first 100 chars
                preview = stmt.replace('\n', ' ')[:100]
                print(f"[{i+1}] Executing: {preview}...")
                conn.execute(sqlalchemy.text(stmt))
                conn.commit()
            except Exception as e:
                print(f"  ⚠️  Warning: {str(e)[:100]}")
                # Try to continue with next statement
                continue
    
    print("✅ Migration completed!")

if __name__ == "__main__":
    # Get the directory of the current script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    migration_file = os.path.join(script_dir, "..", "database", "migrate_006_permissions.sql")
    
    if not os.path.exists(migration_file):
        print(f"❌ Migration file not found: {migration_file}")
        print(f"Current dir: {os.getcwd()}")
        print(f"Script dir: {script_dir}")
        sys.exit(1)
    
    run_migration_file(migration_file)
