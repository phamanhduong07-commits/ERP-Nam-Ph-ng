"""
Lưu lịch sử chat theo session_id — Chuyển từ SQLite sang PostgreSQL để đồng nhất hệ thống.
Bảng: agent_sessions (nằm trong ERP DB chính)
"""

import json
import time
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from app.database import SessionLocal

_SESSION_TTL_HOURS = 8
_MAX_TURNS = 20  # tối đa 20 lượt (40 message)


def get_history(session_id: str) -> list[dict]:
    _cleanup()
    with SessionLocal() as db:
        result = db.execute(
            text("SELECT history_json FROM agent_sessions WHERE session_id = :sid"),
            {"sid": session_id}
        ).fetchone()
        
        if not result:
            return []
            
        _touch(session_id)
        # SQLAlchemy returns JSONB as a dict/list directly
        history = result[0]
        if isinstance(history, str):
            return json.loads(history)
        return history


def add_turn(session_id: str, user_msg: str, assistant_msg: str, user_id: int | None = None) -> None:
    history = get_history(session_id)
    history.append({"role": "user", "content": user_msg})
    history.append({"role": "assistant", "content": assistant_msg})
    
    if len(history) > _MAX_TURNS * 2:
        history = history[-(_MAX_TURNS * 2):]
        
    with SessionLocal() as db:
        # PostgreSQL ON CONFLICT (session_id) DO UPDATE
        db.execute(
            text("""
                INSERT INTO agent_sessions (session_id, user_id, history_json, last_active)
                VALUES (:sid, :uid, :history, NOW())
                ON CONFLICT (session_id) DO UPDATE SET
                    history_json = EXCLUDED.history_json,
                    last_active = EXCLUDED.last_active,
                    user_id = COALESCE(EXCLUDED.user_id, agent_sessions.user_id)
            """),
            {
                "sid": session_id,
                "uid": user_id,
                "history": json.dumps(history, ensure_ascii=False)
            }
        )
        db.commit()


def clear_session(session_id: str) -> None:
    with SessionLocal() as db:
        db.execute(
            text("DELETE FROM agent_sessions WHERE session_id = :sid"),
            {"sid": session_id}
        )
        db.commit()


def list_sessions(user_id: int) -> list[dict]:
    with SessionLocal() as db:
        rows = db.execute(
            text("""
                SELECT session_id, last_active 
                FROM agent_sessions 
                WHERE user_id = :uid 
                ORDER BY last_active DESC 
                LIMIT 20
            """),
            {"uid": user_id}
        ).fetchall()
        
        return [
            {"session_id": r[0], "last_active": r[1].timestamp() if r[1] else time.time()} 
            for r in rows
        ]


def _touch(session_id: str) -> None:
    with SessionLocal() as db:
        db.execute(
            text("UPDATE agent_sessions SET last_active = NOW() WHERE session_id = :sid"),
            {"sid": session_id}
        )
        db.commit()


def _cleanup() -> None:
    cutoff = datetime.now(timezone.utc) - timedelta(hours=_SESSION_TTL_HOURS)
    with SessionLocal() as db:
        db.execute(
            text("DELETE FROM agent_sessions WHERE last_active < :cutoff"),
            {"cutoff": cutoff}
        )
        db.commit()
