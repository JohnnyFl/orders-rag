import "dotenv/config";
import { z } from "zod";
import { writeFileSync } from "node:fs";
import { qdrant, COLLECTION_V1 } from "../src/clients/qdrant";
import { parseWithZod } from "../src/clients/openai";

const Item = z.object({
    question: z.string().describe("Realistic analyst question answerable from the docs shown"),
    expected_doc_ids: z.array(z.string()).describe("doc_ids that answer the question (from the shown docs)"),
    expected_label: z.enum(["shipping_order","invoice","purchase_order","report"]),
});
const Batch = z.object({ items: z.array(Item) });

const SYS = `You generate retrieval evaluation questions for a RAG system over business documents.

Below are real documents. For each batch, generate ONE realistic question that a business analyst would ask,
AND identify the doc_ids that would answer it.

Rules:
- Questions must be answerable from the documents shown.
- Vary by topic: customer, date, country, product, totals.
- expected_doc_ids MUST come from the documents shown.
- DO NOT generate aggregation questions ("how many", "total of", "average").`;

const docs: Array<{doc_id: string; label: string; text: string}> = [];
let offset: string | number | undefined;
while (true) {
    const r: any = await qdrant().scroll(COLLECTION_V1, {
        limit: 100, with_payload: true, with_vector: false, offset,
    });
    for (const p of r.points) {
        docs.push({
            doc_id: String(p.payload?.doc_id ?? ""),
            label: String(p.payload?.label ?? ""),
            text: String(p.payload?.text ?? "").slice(0, 600),
        });
    }
    if (!r.next_page_offset) break;
    offset = r.next_page_offset;
}
console.log(`Scrolled ${docs.length} docs.`);

const BATCH = 8;
const PER = 3;
const examples: any[] = [];
for (let i = 0; i < docs.length; i += BATCH) {
    const chunk = docs.slice(i, i + BATCH);
    const blob = chunk.map(d => `--- doc_id=${d.doc_id} label=${d.label} ---\n${d.text}`).join("\n\n");
    try {
        const { data } = await parseWithZod({
            schema: Batch, name: "eval_batch",
            system: `${SYS}\n\nDocuments:\n${blob}`,
            user: `Generate ${PER} questions.`,
        });
        for (const it of data.items) {
            examples.push({ question: it.question, kind: "retrieval", expected_doc_ids: it.expected_doc_ids, expected_label: it.expected_label });
        }
        console.log(`Batch ${Math.floor(i/BATCH)+1}: +${data.items.length} (total ${examples.length})`);
    } catch (e) {
        console.error(`Batch ${Math.floor(i/BATCH)+1} failed: ${(e as Error).message}`);
    }
}

writeFileSync("data/eval_generated.jsonl", examples.map(e => JSON.stringify(e)).join("\n") + "\n");
console.log(`\nWrote ${examples.length} examples.`);