#!/usr/bin/env bash
set -e
TS=$(date +%Y%m%d-%H%M%S)
bun run scripts/run_eval.ts
RAW=$(ls -t data/eval_results/*_raw.jsonl | head -1)
scripts/.venv/bin/python scripts/eval_ragas.py "$RAW"
bun run scripts/summarize_eval.ts "$RAW"