import re
from pathlib import Path

routers_dir = Path("app/routers")
results = {}

auth_keywords = {
    "get_current_user",
    "get_optional_user", 
    "get_admin_user",
    "require_roles",
    "require_permissions",
    "require_any_permission",
}

# Public endpoints that are intentionally open (login, health, public APIs)
PUBLIC_ENDPOINTS_PATTERNS = {
    r"/api/auth/login",
    r"/api/auth/refresh",
    r"/api/health",
}

for router_file in sorted(routers_dir.glob("*.py")):
    if router_file.name == "__init__.py":
        continue
    
    content = router_file.read_text()
    
    # Find all route decorators with their full context (including next function def)
    # Pattern: @router.METHOD(...) followed by optional decorators and def
    pattern = r'@router\.(get|post|put|patch|delete)\((["\']?)([^"\']+?)\2\)[^\n]*(?:\n(?:@[^\n]*|\s)*)*\n\s*(?:async\s+)?def\s+(\w+)\([^)]*\)'
    
    matches = list(re.finditer(pattern, content))
    
    if not matches:
        continue
    
    unprotected = []
    protected = []
    
    for match in matches:
        method = match.group(1).upper()
        path = match.group(3)
        func_name = match.group(4)
        full_match = match.group(0)
        
        # Check if this endpoint has auth in its function signature
        has_auth = any(keyword in full_match for keyword in auth_keywords)
        
        endpoint_str = f"{method} {path}"
        
        # Check if it's a known public endpoint
        is_public = any(re.search(p, f"/api/{path}") for p in PUBLIC_ENDPOINTS_PATTERNS)
        
        if is_public or has_auth:
            protected.append(endpoint_str)
        else:
            unprotected.append(endpoint_str)
    
    if unprotected:
        results[router_file.name] = {
            "unprotected": unprotected,
            "protected": protected,
        }

print("=" * 100)
print("AUTHENTICATION/AUTHORIZATION AUDIT - UNPROTECTED ENDPOINTS")
print("=" * 100)

total_unprotected = 0
for filename in sorted(results.keys()):
    data = results[filename]
    unprotected = data["unprotected"]
    total_unprotected += len(unprotected)
    
    print(f"\n{filename}")
    print("-" * 100)
    for endpoint in sorted(unprotected):
        print(f"  - {endpoint}")

print("\n" + "=" * 100)
print(f"TOTAL UNPROTECTED ENDPOINTS: {total_unprotected}")
print("=" * 100)
