import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { parse } from "csv-parse";   // bun add csv-parse
import type { Label } from "../schema";
import { normalizeLabel } from "../schema";

export type RawDoc = {
    text: string;
    raw_label: string;
    label: Label;
    word_count: number;
    doc_id: string;
};

export function stableId(text: string): string {
    return createHash("sha256").update(text).digest("hex").slice(0, 16);
}

/** Streaming CSV reader — calls fn for each row. */
export async function readCsv(path: string, fn: (d: RawDoc) => Promise<void> | void): Promise<void> {
    const parser = createReadStream(path).pipe(parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_quotes: true,
    }));
    for await (const row of parser) {
        const text = String(row.text ?? "").trim();
        if (!text) continue;
        const raw_label = String(row.label ?? "").trim();
        const wc = Number(row.word_count ?? 0) || 0;
        await fn({
            text,
            raw_label,
            label: normalizeLabel(raw_label),
            word_count: wc,
            doc_id: stableId(text),
        });
    }
}