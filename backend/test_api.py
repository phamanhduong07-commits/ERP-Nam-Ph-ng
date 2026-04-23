import urllib.request, urllib.parse, json

data = urllib.parse.urlencode({"username":"admin","password":"Admin@123"}).encode()
req = urllib.request.Request("http://localhost:8000/api/auth/login", data=data)
resp = urllib.request.urlopen(req)
token = json.loads(resp.read())["access_token"]
print(f"Token OK: {token[:30]}")

for ep in ["/api/quotes", "/api/customers?page_size=1", "/api/paper-materials/search?q=KA&limit=2"]:
    req2 = urllib.request.Request(f"http://localhost:8000{ep}",
        headers={"Authorization": f"Bearer {token}"})
    try:
        resp2 = urllib.request.urlopen(req2)
        print(f"OK {ep}: {resp2.read()[:80]}")
    except Exception as e:
        print(f"FAIL {ep}: {e}")
