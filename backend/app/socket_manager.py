"""Socket.io server với CORS strict + JWT auth verify.

Trước: cors='*' + không verify token → mọi client lạ connect được + nhận broadcast.
Sau:
  - CORS chỉ allow ALLOWED_ORIGINS từ settings (đồng bộ với HTTP CORS).
  - Connect handler decode JWT từ auth payload → reject nếu invalid.
  - User được join room theo role: "role:ADMIN", "role:NHAN_SU"... → emit có thể
    target room thay vì broadcast all.
"""
from __future__ import annotations

import logging
from typing import Optional

import socketio
from jose import jwt, JWTError

from app.config import settings

logger = logging.getLogger("erp.socket")


# CORS: parse từ settings.ALLOWED_ORIGINS (CSV string) thay vì wildcard '*'
_origins_csv = getattr(settings, "ALLOWED_ORIGINS", "") or ""
_cors: list[str] = [o.strip() for o in _origins_csv.split(",") if o.strip()] or [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]


sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=_cors,
    logger=False,         # Tắt verbose log mặc định (chỉ log connect/disconnect)
    engineio_logger=False,
)


@sio.event
async def connect(sid: str, environ: dict, auth: Optional[dict] = None):
    """Verify JWT từ auth payload khi client connect.

    Client connect kèm auth: { token: 'Bearer xxx' } hoặc { token: 'xxx' }.
    Nếu token invalid/missing → raise ConnectionRefusedError.
    Nếu hợp lệ → join room "role:<role_code>" cho phép HR-only broadcasts.
    """
    token = None
    if auth and isinstance(auth, dict):
        token = auth.get("token") or auth.get("access_token")
    if not token:
        # P1 HARDENING: chặn anonymous connect — trước đây cho phép vào nhưng không join
        # room, vẫn nhận broadcast (vd machine_status_update từ cd2.py).
        # Để đảm bảo mọi sio.emit() không leak qua client lạ → reject không token.
        logger.warning("Socket %s reject: no auth token", sid)
        raise socketio.exceptions.ConnectionRefusedError("Yêu cầu token xác thực")

    # Strip "Bearer " prefix nếu có
    if token.lower().startswith("bearer "):
        token = token[7:]

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise socketio.exceptions.ConnectionRefusedError("Token thiếu sub")
    except JWTError as e:
        logger.warning("Socket %s reject: invalid token (%s)", sid, e)
        raise socketio.exceptions.ConnectionRefusedError("Token không hợp lệ")

    # Lookup user role để join room
    try:
        from app.database import SessionLocal
        from app.models.auth import User as _User
        with SessionLocal() as db:
            user = db.query(_User).filter(_User.id == int(user_id), _User.trang_thai == True).first()
            if not user:
                raise socketio.exceptions.ConnectionRefusedError("User không tồn tại / bị khóa")
            role_code = (user.role.ma_vai_tro or "").upper() if user.role else ""
    except socketio.exceptions.ConnectionRefusedError:
        raise
    except Exception as exc:  # noqa: BLE001
        logger.warning("Socket %s role lookup failed: %s", sid, exc)
        return

    # Lưu user context vào session + join các room phù hợp
    await sio.save_session(sid, {"user_id": int(user_id), "role": role_code})
    await sio.enter_room(sid, f"user:{user_id}")
    if role_code:
        await sio.enter_room(sid, f"role:{role_code}")
        # HR/Admin/BGD vào room chung cho HR notifications
        if role_code in ("ADMIN", "NHAN_SU", "GIAM_DOC", "BGD"):
            await sio.enter_room(sid, "hr_admins")
    logger.info("Socket %s connected as user=%s role=%s", sid, user_id, role_code)


@sio.event
async def disconnect(sid: str):
    logger.info("Socket %s disconnected", sid)


# ASGI app để mount vào FastAPI
socket_app = socketio.ASGIApp(sio, socketio_path='')


async def sio_emit(event: str, data: dict, room: str | None = None, **kwargs) -> None:
    """Emit Socket.io event an toàn — không raise, không block HTTP response.

    Nếu Socket.io server không khả dụng (restart, mạng chập chờn, chưa có client),
    chỉ log WARNING và return. DB mutation của caller đã commit trước khi hàm này
    được gọi, nên HTTP response luôn thành công dù socket có lỗi hay không.

    Usage:
        from app.socket_manager import sio_emit
        await sio_emit("machine_status_update", {"phieu_in_id": x, "event": "started"})
    """
    try:
        await sio.emit(event, data, room=room, **kwargs)
    except Exception:
        logger.warning("sio_emit(%r) failed", event, exc_info=True)
