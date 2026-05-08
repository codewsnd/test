# core

FastAPI + Uvicorn service using Google ADK `1.19.0` to call the local oMLX
OpenAI-compatible model.

## Setup

```bash
cd core
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requreiments/base.txt
cp .env.example .env
```

## Run

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

## Run on macOS

If `python3.12` is not installed on macOS, install it first:

```bash
brew install python@3.12
```

Then run the service with the following commands:

```bash
cd /Users/deft/dev/github/test/core
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requreiments/base.txt
cp .env.example .env
uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```

After startup, you can verify the service with:

```bash
curl -X POST http://127.0.0.1:8001/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"你好，简单介绍一下你自己"}]}'
```

## Endpoints

```bash
curl -X POST http://127.0.0.1:8000/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"你好，简单介绍一下你自己"}]}'

curl -N -X POST http://127.0.0.1:8000/chat/stream \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"用三句话介绍 Google ADK"}]}'
```

Configuration is read from `.env`. Preferred keys are:

- `spring.ai.openai.base-url`
- `spring.ai.openai.api-key`
- `spring.ai.openai.chat.options.model`
- `MCP_ENABLED`
- `MCP_SERVER_URL`
- `MCP_TOOL_NAMES`
- `SKILLS_ENABLED`
- `SKILLS_CATALOG_PATH`

If the configured OpenAI-compatible `base-url` has no path, the service will
automatically normalize it to include `/v1`.

Legacy `OMLX_*` aliases are still supported for backward compatibility.

When `MCP_ENABLED=true`, the ADK agent will load tools from the
`springboot3-backend` MCP endpoint, which defaults to
`http://127.0.0.1:8082/mcp`.

## Skills

The service exposes selectable model skills at:

```bash
curl http://127.0.0.1:8000/api/v1/skills
```

Built-in skills are available by default. To add local custom skills, set
`SKILLS_CATALOG_PATH` to either a JSON file containing `{ "skills": [...] }` or
a directory with one or more `SKILL.md` files.

Chat requests can pass `skillIds` for one-off injection. Agent-bound skills are
read from `chat_agents_info.template_schemas` as JSON, for example:

```json
{"skillIds":["test-case-writer","structured-output"]}
```

## CORS

By default, the service allows browser requests from `localhost` and
`127.0.0.1` on any port, and also allows the `null` origin for local desktop
or file-based clients.

If you need to allow additional origins, update `.env`:

```bash
CORS_ALLOW_ORIGINS=null,https://your-domain.example
CORS_ALLOW_ORIGIN_REGEX=^https?://(localhost|127\.0\.0\.1)(:\d+)?$
```
