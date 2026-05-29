import "dotenv/config";
import { readCsv } from "../src/ingest/csv";
import { extract } from "../src/ingest/pipeline";

const INPUT = process.argv[2] ?? "data/docs.csv";

const labels = new Map<string, number>();
const fill = new Map<string, number>();
let total = 0, llmCalls = 0;
const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

await readCsv(INPUT, async (raw) => {
    total++;
    inc(labels, raw.label);
    try {
        const { payload, usedLlm } = await extract(raw.text, raw.label);
        if (usedLlm) llmCalls++;
        for (const k of [
            "order_id","order_date","shipped_date","customer_id",
            "customer_name","employee_name","shipper_name",
            "ship_country","ship_city","ship_region","total_price",
            "report_category","report_period",
        ] as const) {
            if (payload[k] != null) inc(fill, k);
        }
        if (payload.products.length > 0) fill.set("products", (fill.get("products") ?? 0) + payload.products.length);
        if (total % 50 === 0) console.log(`  ... ${total} (${llmCalls} via LLM)`);
    } catch (e) {
        console.error(`row ${total}: ${(e as Error).message}`);
    }
});

console.log(`\nProcessed ${total} docs. LLM fallback: ${llmCalls} (${(llmCalls/total*100).toFixed(1)}%)\n`);
console.log("Labels:");
[...labels.entries()].sort().forEach(([k,v]) => console.log(`  ${k.padEnd(20)} ${v}`));
console.log("\nFill rates:");
const fields = ["order_id","order_date","shipped_date","customer_id","customer_name",
    "employee_name","shipper_name","ship_country","ship_city","ship_region",
    "total_price","report_category","report_period"];
for (const f of fields) {
    const pct = total ? (fill.get(f) ?? 0) / total * 100 : 0;
    console.log(`  ${f.padEnd(18)} ${pct.toFixed(1).padStart(5)}%`);
}
if (total) console.log(`  products (sum)     ${fill.get("products") ?? 0} (avg ${((fill.get("products") ?? 0)/total).toFixed(1)}/doc)`);