import logging
import time
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app.models.auth import User
from app.config import settings
from . import orchestrator, session_store
from .ollama_provider import check_ollama_available

logger = logging.getLogger("erp.agent")

router = APIRouter(prefix="/api/agent", tags=["agent"])


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None


class ChatResponse(BaseModel):
    reply: str
    session_id: str


@router.get("/status")
def agent_status(_: User = Depends(get_current_user)):
    return {
        "provider": settings.AGENT_PROVIDER,
        "ollama_url": settings.OLLAMA_URL,
        "ollama_model": settings.OLLAMA_MODEL,
        "ollama_available": check_ollama_available(),
        "anthropic_configured": bool(settings.ANTHROPIC_API_KEY),
    }


@router.post("/chat", response_model=ChatResponse)
def chat(
    req: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Tin nhắn không được để trống")

    session_id = req.session_id or f"u{user.id}-{int(time.time())}"
    history = session_store.get_history(session_id)

    user_role = user.role.ma_vai_tro if user.role else "UNKNOWN"
    user_name = user.ho_ten or user.username

    logger.info("[Agent] user=%s role=%s session=%s msg=%.80s",
                user.username, user_role, session_id, req.message)

    t0 = time.time()
    reply = orchestrator.chat(
        message=req.message,
        history=history,
        db=db,
        user_role=user_role,
        user_name=user_name,
        user_id=user.id,
    )
    elapsed = round((time.time() - t0) * 1000)
    logger.info("[Agent] done in %dms session=%s", elapsed, session_id)

    session_store.add_turn(session_id, req.message, reply, user_id=user.id)

    return ChatResponse(reply=reply, session_id=session_id)


@router.get("/sessions")
def list_sessions(user: User = Depends(get_current_user)):
    sessions = session_store.list_sessions(user.id)
    return {"sessions": sessions}


@router.get("/sessions/{session_id}/history")
def get_history(
    session_id: str,
    _: User = Depends(get_current_user),
):
    history = session_store.get_history(session_id)
    return {"session_id": session_id, "history": history, "turns": len(history) // 2}


@router.delete("/sessions/{session_id}")
def clear_session(
    session_id: str,
    _: User = Depends(get_current_user),
):
    session_store.clear_session(session_id)
    return {"message": "Session đã được xóa"}
