"""
Lưu lịch sử chat theo session_id — SQLite để persist qua restart.
File DB: backend/agent_sessions.db (tách riêng khỏi ERP DB)
"""

import json
import sqlite3
import time
import os
from pathlib import Path

_DB_PATH = Path(__file__).parent.parent.parent / "agent_sessions.db"
_SESSION_TTL = 8 * 60 * 60   # 8 tiếng
_MAX_TURNS   = 20             # tối đa 20 lượt (40 message: 20 user + 20 assistant)


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(str(_DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def _init_db() -> None:
    with _get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS agent_sessions (
                session_id   TEXT PRIMARY KEY,
                user_id      INTEGER,
                history_json TEXT NOT NULL DEFAULT '[]',
                last_active  REAL NOT NULL
            )
        """)
        conn.commit()


_init_db()


def get_history(session_id: str) -> list[dict]:
    _cleanup()
    with _get_conn() as conn:
        row = conn.execute(
            "SELECT history_json FROM agent_sessions WHERE session_id = ?",
            (session_id,)
        ).fetchone()
    if not row:
        return []
    _touch(session_id)
    return json.loads(row["history_json"])


def add_turn(session_id: str, user_msg: str, assistant_msg: str, user_id: int | None = None) -> None:
    history = get_history(session_id)
    history.append({"role": "user",      "content": user_msg})
    history.append({"role": "assistant", "content": assistant_msg})
    if len(history) > _MAX_TURNS * 2:
        history = history[-(_MAX_TURNS * 2):]
    with _get_conn() as conn:
        conn.execute("""
            INSERT INTO agent_sessions (session_id, user_id, history_json, last_active)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
                history_json = excluded.history_json,
                last_active  = excluded.last_active
        """, (session_id, user_id, json.dumps(history, ensure_ascii=False), time.time()))
        conn.commit()


def clear_session(session_id: str) -> None:
    with _get_conn() as conn:
        conn.execute("DELETE FROM agent_sessions WHERE session_id = ?", (session_id,))
        conn.commit()


def list_sessions(user_id: int) -> list[dict]:
    with _get_conn() as conn:
        rows = conn.execute(
            "SELECT session_id, last_active FROM agent_sessions WHERE user_id = ? ORDER BY last_active DESC LIMIT 20",
            (user_id,)
        ).fetchall()
    return [{"session_id": r["session_id"], "last_active": r["last_active"]} for r in rows]


def _touch(session_id: str) -> None:
    with _get_conn() as conn:
        conn.execute(
            "UPDATE agent_sessions SET last_active = ? WHERE session_id = ?",
            (time.time(), session_id)
        )
        conn.commit()


def _cleanup() -> None:
    cutoff = time.time() - _SESSION_TTL
    with _get_conn() as conn:
        conn.execute("DELETE FROM agent_sessions WHERE last_active < ?", (cutoff,))
        conn.commit()
