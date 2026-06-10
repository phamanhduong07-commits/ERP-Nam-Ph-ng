"""Ollama-backed ERP agent provider.

Ollama does not need an API key and runs locally at http://localhost:11434.
The provider uses a strict JSON protocol so local models can still drive the
existing ERP tools without depending on vendor-specific tool calling.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
from sqlalchemy.orm import Session

from app.config import settings
from .tools import SYSTEM_PROMPT, TOOL_DEFINITIONS
from .tool_executor import execute_tool


CONFIRM_WORDS = ("co", "ok", "yes", "dong y", "xac nhan", "thuc hien")
WRITE_PREFIXES = ("create_", "update_")

# Patterns that indicate the model fabricated ERP data without calling a tool
_HALLUCINATION_PATTERNS = [
    r"\d+\s*(đơn hàng|đơn mua|lệnh\s*sx|lệnh sản xuất|báo giá|khách hàng)",
    r"doanh thu.{0,40}\d{6,}",
    r"\d{1,3}(,\d{3}){1,}(đ|đồng| VND)",
    r"hôm nay có \d+",
    r"tháng \d+/\d{4}.{0,30}\d{6,}",
    r"\d+\s*(tồn kho|sản phẩm|nhà cung cấp|nhân viên)",
]

_DATA_KEYWORDS = [
    "đơn hàng", "đơn mua", "lệnh sx", "lệnh sản xuất",
    "doanh thu", "tồn kho", "báo giá",
    "chờ duyệt", "đang chạy", "bao nhiêu", "thống kê",
    "tổng tiền", "số lượng", "hôm nay", "tháng này",
]


def _is_data_query(text: str) -> bool:
    t = text.lower()
    return any(kw in t for kw in _DATA_KEYWORDS)


def _has_hallucinated_data(reply: str) -> bool:
    r = reply.lower()
    return any(re.search(p, r) for p in _HALLUCINATION_PATTERNS)


def chat_with_ollama(
    message: str,
    history: list[dict],
    db: Session,
    user_role: str,
    user_name: str,
    user_id: int | None = None,
) -> str:
    messages = _build_ollama_messages(history, message, user_role, user_name)
    last_user_text = " ".join(
        [turn.get("content", "") for turn in history[-4:] if turn.get("role") == "user"] + [message]
    )

    tool_called = False
    for iteration in range(settings.AGENT_MAX_ITERATIONS):
        raw = _ollama_chat(messages)
        command = _parse_json_command(raw)

        if not command:
            return raw.strip() or "Xin loi, toi chua xu ly duoc yeu cau nay."

        if command.get("reply"):
            reply_text = str(command["reply"]).strip()
            # Guard: reject if model fabricated ERP data without calling any tool
            if not tool_called and _has_hallucinated_data(reply_text):
                messages.append({"role": "assistant", "content": raw})
                messages.append({
                    "role": "user",
                    "content": (
                        "CẢNH BÁO: Bạn vừa trả lời với số liệu cụ thể mà chưa gọi tool nào. "
                        "TUYỆT ĐỐI không được tự bịa số liệu (số đơn hàng, doanh thu, tồn kho...). "
                        "Hãy gọi tool phù hợp để lấy dữ liệu thật từ hệ thống. "
                        "Nếu câu hỏi không cần dữ liệu cụ thể, trả lời chung chung không có con số."
                    ),
                })
                continue
            return reply_text

        tool_name = command.get("tool")
        tool_input = command.get("input") or {}
        if not tool_name:
            return raw.strip() or "Xin loi, toi chua xu ly duoc yeu cau nay."

        if _is_write_tool(tool_name) and not _has_confirmation(last_user_text):
            return (
                "Toi can xac nhan truoc khi thuc hien thao tac ghi du lieu.\n"
                f"Tool: {tool_name}\n"
                f"Du lieu: {json.dumps(tool_input, ensure_ascii=False)}\n"
                "Ban xac nhan thuc hien khong?"
            )

        tool_called = True
        result = execute_tool(tool_name, tool_input, db, executed_by=user_id)
        messages.append({"role": "assistant", "content": raw})
        messages.append({
            "role": "user",
            "content": (
                f"TOOL_RESULT {tool_name}:\n{result}\n\n"
                "Hay tra loi nguoi dung bang JSON {\"reply\":\"...\"}. "
                "Neu can tool khac, tra JSON {\"tool\":\"ten_tool\",\"input\":{...}}."
            ),
        })

    return "Xin loi, yeu cau nay can qua nhieu buoc nen toi tam dung de tranh xu ly sai."


def check_ollama_available() -> bool:
    if settings.OLLAMA_URL.lower() == "disabled":
        return False
    try:
        with httpx.Client(timeout=3) as client:
            response = client.get(f"{settings.OLLAMA_URL.rstrip('/')}/api/tags")
        return response.status_code == 200
    except Exception:
        return False


def _build_ollama_messages(
    history: list[dict],
    current_message: str,
    user_role: str,
    user_name: str,
) -> list[dict]:
    tools_for_prompt = [
        {
            "name": tool["name"],
            "description": tool.get("description", ""),
            "input_schema": tool.get("input_schema", {}),
        }
        for tool in TOOL_DEFINITIONS
    ]
    system_text = (
        SYSTEM_PROMPT
        + f"\n\nNguoi dung hien tai: {user_name} (vai tro: {user_role})."
        + "\n\n== QUAN TRONG - QUY TAC STRICT CHO OLLAMA =="
        + "\nBat buoc tra ve DUNG MOT JSON object, khong markdown, khong text ngoai JSON."
        + "\nNeu can du lieu ERP (so don hang, doanh thu, ton kho, lenh SX, bao gia...), "
        + "PHAI goi tool truoc: {\"tool\":\"ten_tool\",\"input\":{...}}."
        + "\nNeu da du thong tin de tra loi, tra: {\"reply\":\"cau tra loi tieng Viet\"}."
        + "\n!!! TUYET DOI KHONG duoc tu dua ra so lieu cu the (so don hang, tien, so luong) "
        + "ma khong lay tu tool. Neu khong co tool phu hop, noi 'Toi chua co du lieu cho yeu cau nay'."
        + "\nDanh sach tool:\n"
        + json.dumps(tools_for_prompt, ensure_ascii=False)
    )

    messages = [{"role": "system", "content": system_text}]
    for turn in history[-20:]:
        role = turn.get("role")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": current_message})
    return messages


def _ollama_chat(messages: list[dict]) -> str:
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": messages,
        "stream": False,
        "format": "json",
        "keep_alive": "60m",
        "options": {
            "temperature": 0.1,
            "num_predict": 1024,
        },
    }
    with httpx.Client(timeout=settings.OLLAMA_TIMEOUT_SECONDS) as client:
        response = client.post(f"{settings.OLLAMA_URL.rstrip('/')}/api/chat", json=payload)
        response.raise_for_status()
    data = response.json()
    return (data.get("message") or {}).get("content", "") or data.get("response", "")


def _parse_json_command(raw: str) -> dict[str, Any] | None:
    text = raw.strip()
    if not text:
        return None
    try:
        parsed = json.loads(text)
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        pass

    match = re.search(r"\{[\s\S]*\}", text)
    if not match:
        return None
    try:
        parsed = json.loads(match.group(0))
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def _is_write_tool(tool_name: str) -> bool:
    return tool_name.startswith(WRITE_PREFIXES)


def _has_confirmation(text: str) -> bool:
    normalized = _strip_vietnamese(text.lower())
    return any(word in normalized for word in CONFIRM_WORDS)


def _strip_vietnamese(text: str) -> str:
    replacements = {
        "àáạảãâầấậẩẫăằắặẳẵ": "a",
        "èéẹẻẽêềếệểễ": "e",
        "ìíịỉĩ": "i",
        "òóọỏõôồốộổỗơờớợởỡ": "o",
        "ùúụủũưừứựửữ": "u",
        "ỳýỵỷỹ": "y",
        "đ": "d",
    }
    result = text
    for chars, repl in replacements.items():
        for char in chars:
            result = result.replace(char, repl)
    return result
