# Ollama Dev Workflow

Dung Ollama de chay Agent local khi khong muon goi API ngoai.

## Cai dat va chay model

```powershell
ollama serve
ollama pull gemma4:latest
```

Trong `backend/.env`:

```text
AGENT_PROVIDER=ollama
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:latest
OLLAMA_TIMEOUT_SECONDS=60
```

Khoi dong backend va vao `/agent`.

## Debug

- Neu agent timeout, tang `OLLAMA_TIMEOUT_SECONDS` hoac dung model nho hon.
- Neu Ollama khong chay, Agent phai tra loi loi than thien thay vi lam sap backend.
- Neu can so lieu that, kiem tra tool executor co query dung module khong.

## Khi nao dung Anthropic

- Can chat tot hon hoac suy luan phuc tap.
- Can test write tools co confirm.
- Can so sanh chat local voi model production.

Dat:

```text
AGENT_PROVIDER=anthropic
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-6
```
