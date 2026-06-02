import "dotenv/config";
import { readCsv } from "../src/ingest/csv";
import { extract } from "../src/ingest/pipeline";
import { COLLECTION_V1, COLLECTION_V2_HYBRID,
    ensureCollection, ensureHybridCollection,
    upsertDocs, upsertHybridDocs, payloadFromDoc, } from "../src/clients/qdrant";
import { docEmbedText } from "../src/ingest/embed_text";
import { embed } from "../src/clients/openai";
import type { DocPayload } from "../src/schema";

const INPUT = process.argv.slice(2).find(a => !a.startsWith("--")) ?? "data/docs.csv";
const CACHE = INPUT.replace(/\.csv$/, "") + ".cache.jsonl";
const UPSERT_BATCH = 500;
const EMBED_BATCH = 96;
const BAR_WIDTH = 36;

const hybrid = process.argv.includes("--hybrid");


// ── helpers ────────────────────────────────────────────────────────────────

function bar(done: number, total: number): string {
    const pct = total > 0 ? done / total : 0;
    const filled = Math.round(pct * BAR_WIDTH);
    return "[" + "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled) + "]";
}

function eta(elapsed: number, done: number, total: number): string {
    if (done === 0) return "--";
    const remaining = (elapsed / done) * (total - done);
    if (remaining < 60) return `${Math.ceil(remaining)}s`;
    return `${Math.floor(remaining / 60)}m ${Math.ceil(remaining % 60)}s`;
}

function section(title: string) {
    console.log(`\n━━━ ${title} ${"━".repeat(Math.max(0, 52 - title.length))}`);
}

function elapsed(ms: number): string {
    const s = ms / 1000;
    if (s < 60) return `${s.toFixed(1)}s`;
    return `${Math.floor(s / 60)}m ${(s % 60).toFixed(0)}s`;
}

function printProgress(line: string) {
    process.stdout.write(`\r  ${line.padEnd(76)}`);
}

// ── count CSV lines upfront for progress bar ───────────────────────────────

async function countCsvRows(path: string): Promise<number> {
    const text = await Bun.file(path).text();
    return text.split("\n").filter(Boolean).length - 1; // subtract header
}

// ── stage 1: extract or load cache ────────────────────────────────────────

let payloads: DocPayload[];
const labels = new Map<string, number>();
const fill = new Map<string, number>();
const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

const cacheFile = Bun.file(CACHE);
if (await cacheFile.exists()) {
    section("Extract  (cached)");
    const t0 = Date.now();
    payloads = (await cacheFile.text()).split("\n").filter(Boolean).map(l => JSON.parse(l) as DocPayload);
    console.log(`\n  Loaded ${payloads.length} docs from ${CACHE}  (${elapsed(Date.now() - t0)})`);
} else {
    section("Extract");
    const total = await countCsvRows(INPUT);
    console.log(`  Source: ${INPUT}  (${total} rows)`);

    payloads = [];
    let done = 0, llmCalls = 0;
    const t0 = Date.now();
    const cacheWriter = Bun.file(CACHE).writer();

    await readCsv(INPUT, async (raw) => {
        done++;
        const { payload, usedLlm } = await extract(raw.text, raw.label);
        if (usedLlm) llmCalls++;
        payload.doc_id = raw.doc_id;
        payload.text = raw.text;
        payload.word_count = raw.word_count;
        payloads.push(payload);
        cacheWriter.write(JSON.stringify(payload) + "\n");

        inc(labels, raw.label);
        for (const k of [
            "order_id","order_date","shipped_date","customer_id",
            "customer_name","employee_name","shipper_name",
            "ship_country","ship_city","ship_region","total_price",
            "report_category","report_period",
        ] as const) {
            if (payload[k] != null) inc(fill, k);
        }
        if (payload.products.length > 0)
            fill.set("products", (fill.get("products") ?? 0) + payload.products.length);

        const elapsedSec = (Date.now() - t0) / 1000;
        const rate = done / elapsedSec;
        const llmPct = (llmCalls / done * 100).toFixed(0);
        printProgress(
            `${bar(done, total)} ${done}/${total} (${(done/total*100).toFixed(1)}%)` +
            `  LLM: ${llmCalls} (${llmPct}%)  ${rate.toFixed(1)} doc/s  ETA: ${eta(elapsedSec, done, total)}`
        );
    });

    await cacheWriter.flush();
    cacheWriter.end();

    const totalSec = (Date.now() - t0) / 1000;
    process.stdout.write("\n");
    console.log(`\n  Done in ${elapsed(Date.now() - t0 + totalSec * 0 /* already ms */)}  |  ${payloads.length} docs  |  LLM fallback: ${llmCalls} (${(llmCalls/payloads.length*100).toFixed(1)}%)`);

    console.log("\n  Labels:");
    [...labels.entries()].sort().forEach(([k, v]) =>
        console.log(`    ${k.padEnd(22)} ${v}`)
    );

    console.log("\n  Fill rates:");
    const fields = [
        "order_id","order_date","shipped_date","customer_id","customer_name",
        "employee_name","shipper_name","ship_country","ship_city","ship_region",
        "total_price","report_category","report_period",
    ];
    for (const f of fields) {
        const pct = payloads.length ? (fill.get(f) ?? 0) / payloads.length * 100 : 0;
        const bar2 = "▓".repeat(Math.round(pct / 5)) + "░".repeat(20 - Math.round(pct / 5));
        console.log(`    ${f.padEnd(20)} ${bar2}  ${pct.toFixed(1).padStart(5)}%`);
    }
    const prodSum = fill.get("products") ?? 0;
    console.log(`    products (sum)       ${prodSum}  avg ${(prodSum / payloads.length).toFixed(1)}/doc`);
}

// ── stage 2: ensure collection ────────────────────────────────────────────

section("Qdrant");
const t1 = Date.now();
const collection = hybrid ? COLLECTION_V2_HYBRID : COLLECTION_V1;
if (hybrid) await ensureHybridCollection(collection);
else        await ensureCollection(collection);
console.log(`\n  Collection "${COLLECTION_V1}" ready  (${elapsed(Date.now() - t1)})`);

// ── stage 3: embed ────────────────────────────────────────────────────────

section("Embed");
const texts = payloads.map(docEmbedText);
const batches = Math.ceil(texts.length / EMBED_BATCH);
console.log(`  ${texts.length} docs  →  ${batches} batches of ${EMBED_BATCH}`);

const t2 = Date.now();
const vectors: number[][] = [];
for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const slice = texts.slice(i, i + EMBED_BATCH);
    const vecs = await embed(slice);
    vectors.push(...vecs);
    const batchDone = Math.ceil((i + slice.length) / EMBED_BATCH);
    const elapsedSec = (Date.now() - t2) / 1000;
    const rate = vectors.length / elapsedSec;
    printProgress(
        `${bar(vectors.length, texts.length)} batch ${batchDone}/${batches}` +
        `  ${vectors.length}/${texts.length} docs  ${rate.toFixed(0)} doc/s  ETA: ${eta(elapsedSec, vectors.length, texts.length)}`
    );
}
process.stdout.write("\n");
console.log(`\n  Embedded ${vectors.length} docs  (${elapsed(Date.now() - t2)})`);

// ── stage 4: upsert ───────────────────────────────────────────────────────

section("Upsert");

if (hybrid) {
    const items = payloads.map((p, i) => ({
        doc_id: p.doc_id,
        dense: vectors[i]!,
        bm25_text: p.text,     // raw text for BM25
        payload: payloadFromDoc(p),
    }));
    for (let i = 0; i < items.length; i += 500) {
        await upsertHybridDocs(items.slice(i, i + 500), collection);
        console.log(`  upserted ${Math.min(i+500, items.length)}/${items.length}`);
    }
} else {
    const items = payloads.map((p, i) => ({
        doc_id: p.doc_id,
        vector: vectors[i]!,
        payload: payloadFromDoc(p),
    }));

    const t3 = Date.now();
    let upserted = 0;
    for (let i = 0; i < items.length; i += UPSERT_BATCH) {
        await upsertDocs(items.slice(i, i + UPSERT_BATCH));
        upserted = Math.min(i + UPSERT_BATCH, items.length);
        const elapsedSec = (Date.now() - t3) / 1000;
        const rate = upserted / elapsedSec;
        printProgress(
            `${bar(upserted, items.length)} ${upserted}/${items.length}` +
            `  ${rate.toFixed(0)} doc/s  ETA: ${eta(elapsedSec, upserted, items.length)}`
        );
    }
    process.stdout.write("\n");
    console.log(`\n  Upserted ${upserted} docs to "${COLLECTION_V1}"  (${elapsed(Date.now() - t3)})`);
}

// ── summary ───────────────────────────────────────────────────────────────

console.log("\n" + "━".repeat(56));
console.log(`  All done.  ${payloads.length} docs in Qdrant.`);
console.log("━".repeat(56) + "\n");