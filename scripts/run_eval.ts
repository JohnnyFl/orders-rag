import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { answer } from "../src/rag/pipeline";
import { qdrant, COLLECTION_V1 } from "../src/clients/qdrant";

const INPUT = process.argv[2] ?? "data/eval_dataset.jsonl";

type Example = {
    question: string;
    kind: "retrieval" | "aggregation" | "off_topic";
    expected_doc_ids?: string[];
    expected_label?: string;
};

const examples: Example[] = readFileSync(INPUT, "utf8").trim().split("\n").map(l => JSON.parse(l));
console.log(`Loaded ${examples.length} examples.`);

// Pre-load label index
const labelById = new Map<string, string>();
{
    let offset: any = undefined;
    while (true) {
        const r: any = await qdrant().scroll(COLLECTION_V1, { limit: 200, with_payload: ["doc_id","label"] as any, with_vector: false, offset });
        for (const p of r.points) labelById.set(String(p.payload?.doc_id ?? ""), String(p.payload?.label ?? ""));
        if (!r.next_page_offset) break;
        offset = r.next_page_offset;
    }
}

type Row = {
    question: string;
    kind: Example["kind"];
    expected_doc_ids: string[];
    expected_label: string;
    retrieved: string[];
    contexts: string[];
    answer: string;
    needs_aggregation: boolean;
    no_relevant_docs: boolean;
    label_hit: boolean;
};
const rows: Row[] = [];

for (let i = 0; i < examples.length; i++) {
    const ex = examples[i]!;
    try {
        const { response, hits } = await answer(ex.question);
        const retrieved = hits.map(h => h.doc_id);
        rows.push({
            question: ex.question,
            kind: ex.kind,
            expected_doc_ids: ex.expected_doc_ids ?? [],
            expected_label: ex.expected_label ?? "",
            retrieved,
            contexts: hits.map(h => String(h.payload.text ?? "").slice(0, 800)),
            answer: response.answer,
            needs_aggregation: response.needs_aggregation,
            no_relevant_docs: response.no_relevant_docs,
            label_hit: ex.expected_label
                ? retrieved.some(d => labelById.get(d) === ex.expected_label)
                : true,
        });
    } catch (e) {
        console.error(`[${i+1}] ${(e as Error).message}`);
    }
    if ((i+1) % 10 === 0) console.log(`  ... ${i+1}/${examples.length}`);
}

// Write raw JSONL
mkdirSync("data/eval_results", { recursive: true });
const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0,19);
const rawPath = `data/eval_results/${ts}_raw.jsonl`;
writeFileSync(rawPath, rows.map(r => JSON.stringify(r)).join("\n") + "\n");
console.log(`\nWrote ${rawPath}`);
console.log(`Next: scripts/.venv/bin/python scripts/eval_ragas.py ${rawPath}`);

// (after writing rawPath)
console.log("\nNow run: bun run scripts/summarize_eval.ts " + rawPath);