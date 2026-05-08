# Ollama Dev Sidecar Workflow

Muc tieu: dung Ollama local de giam token khi phat trien ERP. Ollama lam viec doc nhanh, tom tat, nen log/diff. Codex van la tac nhan chinh de quyet dinh, sua code, chay test va chiu trach nhiem ket qua.

## Khi Nao Dung Ollama

- File dai: tom tat truoc cac router/service/model lon.
- Log dai: nen traceback, test output, build output thanh cac loi chinh.
- Diff lon: review local truoc de bat bug ro rang.
- Kham pha codebase: hoi Ollama tom tat 3-8 file lien quan truoc khi dua vao context chinh.
- Boilerplate it rui ro: tao skeleton test, checklist, query mau.

Khong dung Ollama de quyet dinh cuoi cung cho migration, xoa du lieu, logic tien/cong no, bao mat, hoac thay the test that.

## MCP Tools

MCP server nam o:

`D:\NAM_PHUONG_SOFTWARE\mcp-ollama\server.js`

Da co trong:

`D:\NAM_PHUONG_SOFTWARE\.mcp.json`

Tools:

- `ollama_list_models`: xem model local.
- `ollama_run`: prompt tong quat cho task nho.
- `ollama_summarize_files`: doc file trong workspace va tom tat.
- `ollama_compress_context`: nen log/traceback/output dai.
- `ollama_review_diff`: review diff local truoc khi Codex review ky.

## Workflow Chuan Cho Codex

1. Xac dinh module dang lam: vi du ban hang, san xuat, kho, giao hang, hoa don, cong no.
2. Dung `rg` tim file lien quan.
3. Neu file dai, dung `ollama_summarize_files` voi cau hoi cu the.
4. Codex doc truc tiep cac file/dong Ollama chi ra, khong tin mu quang.
5. Sua code bang `apply_patch`.
6. Chay test/API sweep.
7. Neu output dai, dung `ollama_compress_context` de rut gon.
8. Neu diff lon, dung `ollama_review_diff`, roi Codex review lai cac finding.

## Prompt Mau

Tom tat file:

```text
question: "Tim cac diem lam gay luong e2e ban hang -> san xuat -> kho -> giao hang -> hoa don -> cong no"
paths:
- "backend/app/routers/warehouse.py"
- "backend/app/services/billing_service.py"
```

Nen log:

```text
goal: "Rut ra loi can sua tiep theo trong backend FastAPI"
text: "<paste traceback/test output>"
```

Review diff:

```text
focus: "data integrity, trang thai don hang, ton kho, cong no"
diff: "<git diff>"
```

## Cau Hinh Model

Mac dinh hien tai:

```env
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma4
```

Neu can nhanh hon, pull model nhe:

```powershell
ollama pull llama3.2:3b
```

Sau do doi `.mcp.json`:

```json
"OLLAMA_MODEL": "llama3.2:3b"
```

## Nguyen Tac Tiet Kiem Token

- Dua Ollama file/log thuc, dua Codex tom tat + vung can doc ky.
- Khong paste nguyen file lon vao chat neu chua can.
- Moi lan sua xong, nen output test dai thanh 5-10 dong ket luan.
- Voi ERP, van phai uu tien verification bang API/test/db hon la suy luan cua model.
