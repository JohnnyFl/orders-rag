import { readFileSync } from "node:fs";

const raw = process.argv[2];
if (!raw) { console.error("usage: bun run scripts/summarize_eval.ts <raw.jsonl>"); process.exit(1); }
const scored = raw.replace("_raw.jsonl", "_scored.jsonl");

const rows = readFileSync(scored, "utf8").trim().split("\n").map(l => JSON.parse(l));

const mean = (xs: number[]) => xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : 0;
const grouped = (kind: string, fn: (r:any)=>number|null) => {
    const xs = rows.filter(r => r.kind === kind).map(fn).filter((x): x is number => x != null);
    return mean(xs);
};

const ret = rows.filter(r => r.kind === "retrieval");
const agg = rows.filter(r => r.kind === "aggregation");
const off = rows.filter(r => r.kind === "off_topic");

console.log(`\n=== Retrieval (n=${ret.length}) ===`);
console.log(`  Precision:   ${grouped("retrieval", r => r.precision ?? null).toFixed(3)}`);
console.log(`  Recall:      ${grouped("retrieval", r => r.recall ?? null).toFixed(3)}`);
console.log(`  Faithfulness:${grouped("retrieval", r => r.faithfulness ?? null).toFixed(3)}`);
console.log(`  Relevancy:   ${grouped("retrieval", r => r.relevancy ?? null).toFixed(3)}`);
console.log(`  LabelAcc:    ${mean(ret.map(r => r.label_hit ? 1 : 0)).toFixed(3)}`);

console.log(`\n=== Aggregation (n=${agg.length}) ===`);
console.log(`  Refusal rate: ${mean(agg.map(r => r.needs_aggregation ? 1 : 0)).toFixed(3)}`);

console.log(`\n=== Off-topic (n=${off.length}) ===`);
console.log(`  Refusal rate: ${mean(off.map(r => r.no_relevant_docs ? 1 : 0)).toFixed(3)}`);