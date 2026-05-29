# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Runtime

Use Bun instead of Node.js everywhere:

- `bun <file>` not `node` / `ts-node`
- `bun test` not jest/vitest
- `bun install` not npm/yarn/pnpm
- `bunx <pkg>` not npx
- `Bun.file` over `node:fs` readFile/writeFile
- `Bun.$\`cmd\`` instead of execa
- `bun:sqlite` not better-sqlite3; `Bun.sql` not pg/postgres.js; `Bun.redis` not ioredis

## Commands

```bash
bun run dev          # watch mode (src/index.ts)
bun run start        # production server (src/index.ts)
bun run typecheck    # tsc --noEmit

# One-off scripts
bun scripts/ingest.ts [data/docs.csv]   # run extraction pipeline on CSV, prints fill-rate stats
bun scripts/smoke_clients.ts            # smoke-test OpenAI chat, structured output, and embeddings

# Infrastructure
docker compose up -d   # start Qdrant (6333) + Postgres (5433)
```

## Architecture

This is a document ingestion and RAG backend. The HTTP layer (`src/index.ts`) is a **Hono** app (not Express, not `Bun.serve()`).

### Extraction pipeline (`src/ingest/`)

Documents go through a two-stage extraction:

1. **Regex** (`regex.ts`) — fast, zero-cost; handles well-structured docs. Note: the source data uses space-separated decimals (`"38 0"` → 38.00), handled by `parseLooseFloat`.
2. **LLM fallback** (`llm.ts`) — only called when `isIncomplete()` returns true after regex. Uses `parseWithZod` (structured output via `zodResponseFormat`) so the result is type-safe.
3. **Merge** (`pipeline.ts`) — regex fields take precedence; LLM fills only null/undefined gaps.

The exported function is `extract(text, label)` which returns `{ payload: DocPayload, usedLlm: boolean }`.

### Schema (`src/schema.ts`)

`DocPayload` is the central type for all document kinds (`shipping_order`, `invoice`, `purchase_order`, `report`). Fields are shared across types; label-specific fields are nullable/optional. `normalizeLabel` maps raw CSV strings to the `Label` enum.

### OpenAI client (`src/clients/openai.ts`)

Wraps the OpenAI SDK with **LangSmith tracing** (`wrapOpenAI`, `traceable`). Two exports used throughout:
- `parseWithZod` — structured chat completion, returns `{ data, usage }`
- `embed` — batched embeddings (batch size 96), returns `number[][]`

Default models: `gpt-5.4-mini` for chat, `text-embedding-3-small` (1536-dim) for embeddings.

### Infrastructure

| Service  | Image                   | Port mapping  | Notes                    |
|----------|-------------------------|---------------|--------------------------|
| Qdrant   | qdrant/qdrant:v1.12.4   | 6333, 6334    | Vector store             |
| Postgres | postgres:16-alpine      | 5433→5432     | DB: agent_db, user/pass: agent |

Data is persisted in `./qdrant_data` and `./postgres_data` (local bind mounts).

## Environment variables

Required in `.env`:

```
OPENAI_API_KEY=
COHERE_API_KEY=
LANGSMITH_API_KEY=
LANGCHAIN_TRACING_V2=true
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=
LANGSMITH_PROJECT=
QDRANT_HOST=
QDRANT_PORT=
POSTGRES_URL=
FRONTEND_ORIGIN=    # CORS allow-list (default: http://localhost:5173)
PORT=               # HTTP server port (default: 8080)
```
