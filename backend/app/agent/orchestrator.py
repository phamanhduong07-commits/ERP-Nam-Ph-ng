"""ERP agent orchestrator.

The agent can run on local Ollama or Anthropic. Ollama is the default so the
ERP assistant remains useful without external API calls.
"""

import anthropic
from sqlalchemy.orm import Session

from app.config import settings
from .ollama_provider import chat_with_ollama, check_ollama_available
from .tool_executor import execute_tool
from .tools import SYSTEM_PROMPT, TOOL_DEFINITIONS

_client: anthropic.Anthropic | None = None


def _get_client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        _client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _client


def chat(
    message: str,
    history: list[dict],
    db: Session,
    user_role: str,
    user_name: str,
    user_id: int | None = None,
) -> str:
    """Send a user message to the configured ERP agent provider."""
    provider = (settings.AGENT_PROVIDER or "auto").lower()

    if provider == "ollama":
        return chat_with_ollama(message, history, db, user_role, user_name, user_id)

    if provider == "auto" and check_ollama_available():
        return chat_with_ollama(message, history, db, user_role, user_name, user_id)

    try:
        return _chat_with_anthropic(message, history, db, user_role, user_name, user_id)
    except Exception as exc:
        if provider != "anthropic" and check_ollama_available():
            return chat_with_ollama(message, history, db, user_role, user_name, user_id)
        raise exc


def _chat_with_anthropic(
    message: str,
    history: list[dict],
    db: Session,
    user_role: str,
    user_name: str,
    user_id: int | None = None,
) -> str:
    role_hint = f"\nNguoi dung hien tai: {user_name} (vai tro: {user_role})"
    system = [
        {
            "type": "text",
            "text": SYSTEM_PROMPT + role_hint,
            "cache_control": {"type": "ephemeral"},
        }
    ]

    messages = _build_messages(history, message)
    client = _get_client()

    for _ in range(settings.AGENT_MAX_ITERATIONS):
        response = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=2048,
            system=system,
            tools=TOOL_DEFINITIONS,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            return _extract_text(response)

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result = execute_tool(block.name, block.input, db, executed_by=user_id)
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result,
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        else:
            break

    return "Xin loi, toi gap van de khi xu ly yeu cau nay. Vui long thu lai."


def _build_messages(history: list[dict], current_message: str) -> list[dict]:
    """Convert chat history and current message to Anthropic messages."""
    messages = []
    for turn in history[-20:]:
        role = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": current_message})
    return messages


def _extract_text(response) -> str:
    """Extract the first text block from an Anthropic response."""
    for block in response.content:
        if hasattr(block, "text"):
            return block.text
    return ""
