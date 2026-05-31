import "dotenv/config";
import { answer } from "../src/rag/pipeline";

const q = process.argv.slice(2).join(" ");
if (!q) { console.error("usage: bun run scripts/ask.ts <question>"); process.exit(1); }

const { response, hits } = await answer(q);

console.log("=== Retrieved ===");
hits.forEach((h, i) => console.log(`[${i+1}] ${h.doc_id} (score ${h.score.toFixed(3)}, label ${h.payload.label})`));

console.log("\n=== Answer ===");
console.log(response.answer);
if (response.needs_aggregation) console.log("\n(flagged: aggregation needed)");
if (response.no_relevant_docs) console.log("\n(flagged: no relevant docs)");
if (response.citations.length) {
    console.log("\nCitations:");
    for (const c of response.citations) console.log(`  - ${c.doc_id}${c.note ? `: ${c.note}` : ""}`);
}