import json
import urllib.request
import urllib.error
from app.config import settings


def _base() -> str:
    return settings.CD2_URL.rstrip("/")


def cd2_login() -> str:
    payload = json.dumps({"username": settings.CD2_USERNAME, "password": settings.CD2_PASSWORD}).encode()
    req = urllib.request.Request(
        f"{_base()}/auth/login",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read())
    token = data.get("access_token") or data.get("token")
    if not token:
        raise ValueError(f"CD2 login không trả về token: {data}")
    return token


def cd2_create_dhcho(token: str, payload: dict) -> dict:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{_base()}/dhcho",
        data=body,
        headers={
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": f"Bearer {token}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())


def cd2_get_all_dhcho(token: str) -> list:
    req = urllib.request.Request(
        f"{_base()}/dhcho/all",
        headers={"Authorization": f"Bearer {token}"},
        method="GET",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return json.loads(resp.read())
