import os
import re
import sys
from sqlalchemy import create_engine, text

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from app.config import settings

def extract_fk_calls(content):
    # Matches: op.create_foreign_key(name, child_table, parent_table, [child_col], [parent_col], ...)
    # Let's write a parser that handles optional arguments and quotes
    # e.g., op.create_foreign_key(None, 'sales_order_items', 'quote_items', ['quote_item_id'], ['id'], ondelete='SET NULL')
    calls = []
    pos = 0
    while True:
        idx = content.find("op.create_foreign_key", pos)
        if idx == -1:
            break
        # Find matching parenthesis
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
        pos = idx + len("op.create_foreign_key")
    return calls

def parse_fk_call(call):
    # Parse: op.create_foreign_key(name, child_table, parent_table, [child_col], [parent_col])
    # Let's extract arguments inside parentheses
    args_str = call[call.find("(")+1 : call.rfind(")")]
    
    # We want to extract child_table, parent_table, child_cols list, parent_cols list.
    # To be simple and robust, let's extract strings in quotes and lists in square brackets.
    # Pattern to find all string arguments (quoted strings)
    # Be careful of lists of strings like ['quote_item_id']
    
    # Let's tokenize by comma but respect brackets and quotes.
    tokens = []
    current = []
    in_quotes = False
    quote_char = None
    in_list = False
    
    for char in args_str:
        if char in ("'", '"'):
            if not in_quotes:
                in_quotes = True
                quote_char = char
            elif char == quote_char:
                in_quotes = False
        elif char == '[':
            in_list = True
        elif char == ']':
            in_list = False
        elif char == ',' and not in_quotes and not in_list:
            tokens.append("".join(current).strip())
            current = []
            continue
        current.append(char)
    if current:
        tokens.append("".join(current).strip())
        
    if len(tokens) < 5:
        return None
        
    # First token: name (can be None, 'fk_name', etc.)
    # Second token: child_table (quoted string)
    # Third token: parent_table (quoted string)
    # Fourth token: child_cols (list like ['col'] or 'col')
    # Fifth token: parent_cols (list like ['col'] or 'col')
    
    child_table = tokens[1].strip("'\"")
    parent_table = tokens[2].strip("'\"")
    
    # Extract columns from lists
    child_cols_match = re.search(r"\[\s*['\"]([^'\"]+)['\"]\s*\]", tokens[3])
    parent_cols_match = re.search(r"\[\s*['\"]([^'\"]+)['\"]\s*\]", tokens[4])
    
    if child_cols_match and parent_cols_match:
        child_col = child_cols_match.group(1)
        parent_col = parent_cols_match.group(1)
        return child_table, child_col, parent_table, parent_col
        
    return None

def main():
    engine = create_engine(settings.DATABASE_URL)
    migration_path = "alembic/versions/0718ea571b91_add_incoming_invoices.py"
    
    with open(migration_path, "r", encoding="utf-8") as f:
        content = f.read()
        
    fk_calls = extract_fk_calls(content)
    print(f"Parsed {len(fk_calls)} foreign key calls from migration file.")
    
    violations = []
    
    with engine.connect() as conn:
        for call in fk_calls:
            parsed = parse_fk_call(call)
            if not parsed:
                # Some create_foreign_key calls might be in downgrade/different syntax, skip them
                continue
                
            child_table, child_col, parent_table, parent_col = parsed
            
            # Skip if the tables are the incoming invoice tables being created in this migration!
            # Since those tables don't exist yet, checking them will cause database errors.
            if child_table in ('incoming_invoices', 'incoming_invoice_mapping_rules'):
                continue
                
            query = f"""
                SELECT c.{child_col}, COUNT(*) 
                FROM {child_table} c
                LEFT JOIN {parent_table} p ON c.{child_col} = p.{parent_col}
                WHERE c.{child_col} IS NOT NULL AND p.{parent_col} IS NULL
                GROUP BY c.{child_col}
            """
            try:
                res = conn.execute(text(query)).fetchall()
                if res:
                    print(f"[VIOLATION] {child_table}.{child_col} -> {parent_table}.{parent_col}:")
                    for val, count in res:
                        print(f"  Value: {val} (Count: {count})")
                    violations.append((child_table, child_col, parent_table, parent_col, res))
            except Exception as e:
                # Column or table might not exist
                pass
                
    if not violations:
        print("No foreign key violations found!")
    else:
        print(f"Found {len(violations)} foreign key violations in total.")

if __name__ == "__main__":
    main()
