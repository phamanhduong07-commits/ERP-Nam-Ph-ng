# Kế hoạch xây dựng ERP Agent Core — Nam Phương Bao Bì

> Tạo: 2026-05-06 | Trạng thái: Lên kế hoạch

---

## 1. Bối cảnh & Mục tiêu

### Hiện trạng hệ thống
| Component | Tech | Trạng thái |
|-----------|------|-----------|
| ERP Backend | FastAPI + PostgreSQL | ~90% |
| ERP Frontend | React + Ant Design | ~90% |
| Pricing Engine | FastAPI + SQLite | ✅ 100% |
| Zalo AI Bot | Node.js + Gemini | ~85% |

**Vấn đề cần giải quyết:**
- Zalo bot kết nối thẳng vào DB → fragile, không có validation nghiệp vụ
- Không có AI nào trả lời câu hỏi nội bộ (tồn kho, sản xuất, kế toán)
- Claude SDK đã cài trong `zalo-bot/package.json` nhưng chưa dùng
- Không có lớp trung gian để mở rộng AI ra nhiều kênh

### Mục tiêu
Xây một **Python service** (FastAPI) chạy Claude với tool-use, là lớp AI trung tâm cho toàn bộ hệ thống:

```
Zalo Bot ─────────────────────────────┐
Internal Chat UI (mới) ───────────────┤
Email/Voice (tương lai) ──────────────┤──► ERP AGENT CORE ──► ERP API
CLI / Admin queries ──────────────────┘        (Claude)     ──► tinh-gia API
                                                             ──► PostgreSQL (đọc)
```

---

## 2. Kiến trúc

### 2.1 Stack
- **Language:** Python 3.11+
- **AI:** Claude `claude-sonnet-4-6` với tool-use + prompt caching
- **Framework:** FastAPI (nhất quán với ERP backend)
- **Vị trí:** `backend/app/agent/`

### 2.2 Sơ đồ luồng

```
┌─────────────────────────────────────────────────────────┐
│                   ERP AGENT CORE                        │
│                                                         │
│  POST /agent/chat  ──► AgentOrchestrator                │
│                              │                          │
│                    ┌─────────▼──────────┐               │
│                    │   Claude Sonnet    │               │
│                    │   (tool-use mode)  │               │
│                    └─────────┬──────────┘               │
│                              │ tool_calls                │
│              ┌───────────────┼───────────────┐          │
│              ▼               ▼               ▼          │
│         [ERP Tools]    [Pricing Tools]  [Report Tools]  │
│              │               │               │          │
│         ERP FastAPI    tinh-gia API     PostgreSQL       │
│         (localhost)    (localhost)      (direct read)    │
└─────────────────────────────────────────────────────────┘
```

### 2.3 Cấu trúc file

```
backend/app/
└── agent/
    ├── __init__.py
    ├── orchestrator.py      # Vòng lặp agentic chính
    ├── tools.py             # Tool definitions (JSON schema)
    ├── tool_executor.py     # Thực thi tool → gọi ERP API
    ├── session_store.py     # Lưu lịch sử chat (SQLite)
    └── router.py            # FastAPI router /api/agent/*
```

---

## 3. Định nghĩa Tools (Claude tool-use)

### Nhóm 1 — Truy vấn ERP (read-only)

| Tool | Mô tả | Input chính |
|------|-------|------------|
| `query_orders` | Tra cứu đơn hàng | customer_name, order_number, status, date_from/to |
| `query_inventory` | Xem tồn kho | warehouse_type, material_name, low_stock_only |
| `query_production_status` | Tiến độ sản xuất | production_order_id, sales_order_id, status |
| `query_quotes` | Tra cứu báo giá | customer_name, quote_number, status |
| `query_customers` | Tìm khách hàng | name, phone |
| `query_purchase_orders` | Đơn mua hàng | supplier_name, status, date_from |

### Nhóm 2 — Tính giá

| Tool | Mô tả | Input chính |
|------|-------|------------|
| `calculate_price` | Tính giá thùng carton | so_lop, dai, rong, cao, so_luong, so_mau_in, chong_tham, can_mang |

### Nhóm 3 — Thao tác ghi (có xác nhận)

| Tool | Mô tả | Input chính |
|------|-------|------------|
| `create_quote_draft` | Tạo bản nháp báo giá | customer_id, products[], notes |
| `update_order_status` | Cập nhật trạng thái đơn | order_id, new_status, reason |

### Nhóm 4 — Báo cáo

| Tool | Mô tả | Input chính |
|------|-------|------------|
| `generate_report` | Báo cáo tổng hợp | report_type (doanh_thu/san_xuat/ton_kho/cong_no), period |

---

## 4. System Prompt

```python
SYSTEM_PROMPT = """Bạn là trợ lý ERP thông minh của Công ty Nam Phương Bao Bì.
Nhiệm vụ: hỗ trợ nội bộ (giám đốc, kế toán, kinh doanh, kho, sản xuất)
truy vấn và quản lý dữ liệu ERP bằng ngôn ngữ tự nhiên.

Quyền hạn theo role:
- GIAM_DOC: toàn quyền xem + duyệt
- KE_TOAN: xem tài chính, công nợ, phiếu thu/chi
- KINH_DOANH: báo giá, đơn hàng, khách hàng
- KHO: tồn kho, phiếu xuất/nhập
- SAN_XUAT: lệnh SX, kế hoạch SX, BOM
- MUA_HANG: đơn mua hàng, nhà cung cấp

Nguyên tắc:
1. Dùng tool để lấy dữ liệu thực — không đoán mò số liệu
2. Trả lời ngắn gọn, đúng trọng tâm
3. Với thao tác ghi (tạo/sửa/xóa): luôn xác nhận trước khi thực hiện
4. Tiếng Việt, xưng "tôi", gọi user theo chức danh nếu biết"""
```

---

## 5. Code mẫu khởi đầu

### `agent/orchestrator.py`

```python
import anthropic
from .tools import TOOL_DEFINITIONS, SYSTEM_PROMPT
from .tool_executor import ToolExecutor

client = anthropic.Anthropic()

class AgentOrchestrator:
    def __init__(self, db_session, user_role: str):
        self.executor = ToolExecutor(db_session)
        self.user_role = user_role

    async def chat(self, message: str, history: list[dict]) -> str:
        messages = history + [{"role": "user", "content": message}]

        while True:
            response = client.messages.create(
                model="claude-sonnet-4-6",
                max_tokens=1024,
                system=[
                    {
                        "type": "text",
                        "text": SYSTEM_PROMPT,
                        "cache_control": {"type": "ephemeral"},  # prompt caching
                    },
                ],
                tools=TOOL_DEFINITIONS,
                messages=messages,
            )

            if response.stop_reason == "end_turn":
                return response.content[0].text

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        result = await self.executor.execute(block.name, block.input)
                        tool_results.append({
                            "type": "tool_result",
                            "tool_use_id": block.id,
                            "content": str(result),
                        })

                messages.append({"role": "assistant", "content": response.content})
                messages.append({"role": "user", "content": tool_results})
```

### `agent/router.py`

```python
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..auth import get_current_user
from .orchestrator import AgentOrchestrator
from .session_store import SessionStore

router = APIRouter(prefix="/api/agent", tags=["agent"])
session_store = SessionStore()

class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None

@router.post("/chat")
async def chat(req: ChatRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    session_id = req.session_id or f"{user.id}-{int(__import__('time').time())}"
    history = session_store.get_history(session_id)

    orchestrator = AgentOrchestrator(db, user_role=user.role)
    reply = await orchestrator.chat(req.message, history)

    session_store.add_turn(session_id, req.message, reply)
    return {"reply": reply, "session_id": session_id}
```

---

## 6. Lộ trình triển khai

### Phase 1 — Agent Foundation ✅ (1 tuần)
> Mục tiêu: Agent chạy được, trả lời câu hỏi ERP cơ bản qua API

- [x] Tạo thư mục `backend/app/agent/`
- [x] Cài `anthropic` vào `requirements.txt`
- [x] Viết `tools.py` — 7 tool (query_orders, query_quotes, query_production_status, query_inventory, query_customers, query_purchase_orders, get_dashboard_summary)
- [x] Viết `tool_executor.py` — query SQLAlchemy trực tiếp (cùng process)
- [x] Viết `session_store.py` — lưu lịch sử chat in-memory
- [x] Viết `orchestrator.py` — vòng lặp agentic với prompt caching
- [x] Viết `router.py` — endpoint POST /api/agent/chat + GET history + DELETE session
- [x] Đăng ký router trong `main.py`
- [x] Cài `anthropic` vào môi trường Python (`pip install anthropic`)
- [ ] **CÒN LẠI:** Thêm `ANTHROPIC_API_KEY=sk-ant-...` vào `backend/.env` → test thủ công

### Phase 2 — Multi-turn & Write Tools ✅ (1 tuần)
> Mục tiêu: Hội thoại nhiều lượt, thao tác ghi có xác nhận

- [x] Nâng `session_store.py` lên SQLite — persist qua restart, TTL 8 tiếng
- [x] Thêm endpoint `GET /api/agent/sessions` — list sessions của user
- [x] Thêm endpoint `GET /api/agent/sessions/{id}/history`
- [x] Role-based context: user token → inject role + tên vào system prompt
- [x] Write tool `update_order_status` — cập nhật trạng thái đơn hàng
- [x] Write tool `create_quote_draft` — tạo bản nháp báo giá
- [x] Confirm step trong SYSTEM_PROMPT — Claude hỏi xác nhận trước khi gọi write tool
- [x] `generate_report` — báo cáo doanh thu / sản xuất / tồn kho theo kỳ
- [ ] **CÒN LẠI:** Thêm `ANTHROPIC_API_KEY` vào `.env` → test end-to-end

### Phase 3 — Zalo Bot Migration ✅ (1 tuần)
> Mục tiêu: Zalo bot dùng Claude thay Gemini, tool-use thay RAG pinning thủ công

- [x] Viết lại `aiCore.js` dùng `@anthropic-ai/sdk` (Gemini đã xóa)
- [x] 3 tools: `calculate_price`, `get_customer_orders`, `escalate_to_human`
- [x] Bỏ RAG pinning thủ công, RAGStore → Claude tự xử lý qua tools + system prompt
- [x] Escalate bằng tool `escalate_to_human` thay vì parse JSON fallback từ text
- [x] Giữ nguyên: classifier, sender, fallback, contextStore, erpDatabase, namphuongApi
- [x] Cập nhật `config.js`: `anthropicApiKey` thay `geminiApiKey`
- [x] Cập nhật `.env.example`: `ANTHROPIC_API_KEY` thay `GEMINI_API_KEY`
- [ ] **CÒN LẠI:** Thêm `ANTHROPIC_API_KEY` vào `zalo-bot/.env` → test thủ công

### Phase 4 — Internal Chat UI ✅ (2 tuần)
> Mục tiêu: Giao diện chat nội bộ cho nhân viên dùng agent

- [x] Tạo `frontend/src/api/agent.ts` — API client (chat, sessions, history, clear)
- [x] Tạo `frontend/src/pages/agent/AgentPage.tsx` — Chat UI đầy đủ
- [x] Message bubbles (user/assistant) với avatar, màu sắc phân biệt
- [x] Typing indicator (animation 3 chấm) khi chờ Claude trả lời
- [x] 6 Quick action buttons: tổng quan, doanh thu, giao hàng, tồn kho, trễ SX, đơn mua
- [x] Session management: session_id per user, nút xóa hội thoại
- [x] Enter gửi, Shift+Enter xuống dòng
- [x] Route `/agent` trong `App.tsx`, menu "Trợ lý AI" trong sidebar
- [ ] **CÒN LẠI:** Thêm `ANTHROPIC_API_KEY` vào `.env` → `npm run build` → test

---

## 7. Thứ tự ưu tiên

```
Phase 1 → Phase 3 → Phase 2 → Phase 4
```

**Lý do:** Phase 3 (Zalo bot) mang giá trị ngay lập tức vì bot đang live.

---

## 8. Ước tính chi phí Claude API

| Tình huống | Token/request | Chi phí / 1000 req |
|-----------|--------------|-------------------|
| Query đơn giản (có cache) | ~500 input + 200 output | ~$0.15 |
| Query phức tạp (multi-tool) | ~2000 input + 500 output | ~$0.90 |
| Zalo bot (với cache) | ~800 input + 300 output | ~$0.25 |

Prompt caching giảm ~80% chi phí input token — quan trọng với system prompt ~1500 token + tool definitions.

---

## 9. Ghi chú kỹ thuật

- Agent service chạy chung process với ERP backend (cùng port 8000) — không cần service riêng
- Tool executor gọi ERP API nội bộ qua `httpx` (async) hoặc gọi trực tiếp service/repository layer
- Session store dùng SQLite riêng: `backend/agent_sessions.db` (không lẫn với ERP DB)
- Thêm `ANTHROPIC_API_KEY` vào `backend/.env`
