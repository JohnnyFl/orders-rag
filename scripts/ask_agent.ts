import "dotenv/config";
import { buildGraph } from "../src/agent/graph";

const q = process.argv.slice(2).join(" ");
if (!q) { console.error("usage: bun run scripts/ask_agent.ts <question>"); process.exit(1); }

const graph = buildGraph();
const state = await graph.invoke({ question: q });

console.log("=== Expanded queries ===");
for (const eq of state.expanded_queries) console.log(`  - ${eq}`);

console.log("\n=== Answer ===");
console.log(state.answer);

console.log("\n=== Citations ===");
for (const c of state.citations) console.log(`  - ${c.doc_id}${c.note ? `: ${c.note}` : ""}`);

if (process.argv.includes("--trace")) {
    console.log("\n=== Message trace ===");
    for (const m of state.messages) {
        console.log(`  [${m.constructor.name}] ${String(m.content).slice(0, 80)}`);
        const tc = (m as any).tool_calls;
        if (Array.isArray(tc)) for (const t of tc) console.log(`    tool=${t.name} args=${JSON.stringify(t.args)}`);
    }
}