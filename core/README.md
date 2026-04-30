# core

FastAPI + Uvicorn service using Google ADK `1.19.0` to call the local oMLX
OpenAI-compatible model.

## Setup

```bash
cd core
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requreiments/base.txt
```

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Endpoints

```bash
curl http://127.0.0.1:8000/api/v1/health

curl -X POST http://127.0.0.1:8000/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"你好，简单介绍一下你自己"}'

curl -N -X POST http://127.0.0.1:8000/api/v1/stream-chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"用三句话介绍 Google ADK"}'
```

Defaults target:

- base URL: `http://127.0.0.1:22001/v1`
- API key: `root1234`
- model: `Qwen3.5-35B-A3B-4bit`

Copy `.env.example` to `.env` if you want to override them.


# run
```aiignore
source .venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```
