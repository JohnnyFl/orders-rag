# rag-ts

A document ingestion and RAG (Retrieval-Augmented Generation) backend built with TypeScript and Bun.

Ingests business documents (shipping orders, invoices, purchase orders, reports) from CSV, extracts structured fields via a regex → LLM fallback pipeline, and stores them in Qdrant (vectors) and Postgres (metadata/state).

## Stack

- **Runtime** — [Bun](https://bun.sh)
- **HTTP** — [Hono](https://hono.dev)
- **LLM / Embeddings** — OpenAI (`gpt-5.4-mini`, `text-embedding-3-small`)
- **Vector store** — Qdrant
- **Database** — Postgres (LangGraph checkpoint store)
- **Tracing** — LangSmith

## Prerequisites

- [Bun](https://bun.sh) >= 1.3
- Docker (for Qdrant + Postgres)

## Setup

```bash
bun install
docker compose up -d
```

Copy `.env` and fill in the required keys:

```
OPENAI_API_KEY=
COHERE_API_KEY=
LANGSMITH_API_KEY=
LANGCHAIN_TRACING_V2=true
LANGSMITH_TRACING=true
LANGSMITH_ENDPOINT=https://api.smith.langchain.com
LANGSMITH_PROJECT=rag-ts
QDRANT_HOST=localhost
QDRANT_PORT=6333
POSTGRES_URL=postgres://agent:agent@localhost:5433/agent_db
FRONTEND_ORIGIN=http://localhost:5173
PORT=8080
```

## Running

```bash
bun run dev      # watch mode
bun run start    # production
```

The server exposes `GET /healthz` to verify the service is up and the OpenAI key is set.

## Ingestion

Run the extraction pipeline against a CSV file with `text` and `label` columns:

```bash
bun scripts/ingest.ts data/docs.csv
```

This prints per-label counts and fill rates for every extracted field. Each document goes through:

1. **Regex extraction** — fast, zero-cost parsing for well-structured docs
2. **LLM fallback** — `gpt-5.4-mini` structured output (via `zodResponseFormat`) when required fields are missing
3. **Merge** — regex fields take precedence; LLM fills only the gaps

## Smoke test

Verify OpenAI connectivity (chat, structured output, embeddings):

```bash
bun scripts/smoke_clients.ts
```

## Type checking

```bash
bun run typecheck
```
