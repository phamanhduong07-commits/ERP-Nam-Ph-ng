# ERP Agent Core

Agent Core la tro ly AI noi bo nam trong backend ERP. Muc tieu la tra loi cau hoi nghiep vu bang du lieu that va co the mo rong sang thao tac co xac nhan.

## Vi tri code

```text
backend/app/agent/
  router.py
  orchestrator.py
  tools.py
  tool_executor.py
  session_store.py
```

Frontend:

- `frontend/src/api/agent.ts`
- `frontend/src/pages/agent/AgentPage.tsx`
- Route `/agent`

## Cau hinh

Trong `backend/app/config.py`:

- `AGENT_PROVIDER`: `ollama`, `anthropic`, hoac `auto`.
- `OLLAMA_URL`
- `OLLAMA_MODEL`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL`
- `AGENT_MAX_ITERATIONS`

Vi du `.env`:

```text
AGENT_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:latest
ANTHROPIC_API_KEY=
```

## Nguyen tac an toan

- Cau hoi so lieu phai dung tool/query, khong doan.
- Thao tac ghi phai co xac nhan ro.
- Ket qua phai ton trong role/permission cua user.
- Khong dua credential/secret vao prompt.
- Log vua du de debug, khong ghi thong tin nhay cam khong can thiet.

## Tool hien nen co

- Tra cuu don hang.
- Tra cuu bao gia.
- Tra cuu ton kho.
- Tra cuu tien do san xuat.
- Tra cuu khach hang/nha cung cap.
- Tong quan dashboard/bao cao.
- Tao nhap bao gia hoac cap nhat trang thai: chi khi da co confirm.

## Checklist test

- Backend khoi dong khi khong co API key.
- Provider `ollama` loi thi tra loi than thien, khong crash.
- User khong dang nhap khong goi duoc `/api/agent`.
- Agent tra loi duoc cau hoi dashboard co ban.
- Session history hoat dong qua reload page.
