import { QdrantClient } from "@qdrant/js-client-rest";
import { createHash } from "node:crypto";
import { embed, EMBED_DIMENSION } from "./openai";
import type { DocPayload } from "../schema";

export type Hit = {
    doc_id: string;
    score: number;
    payload: Record<string, unknown>;
};

export const COLLECTION_V1 = "documents-v1";

export function qdrant(): QdrantClient {
    return new QdrantClient({
        host: process.env.QDRANT_HOST ?? "localhost",
        port: Number(process.env.QDRANT_PORT ?? 6333),
        checkCompatibility: false,
    });
}

// Deterministic UUIDv5-style ID from doc_id. (We use a simple SHA-based UUID — Qdrant
// accepts UUID strings; deterministic input → deterministic UUID → idempotent upsert.)
export function docIdToUuid(docId: string): string {
    const h = createHash("sha1").update("biz-rag:" + docId).digest("hex");
    return `${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;
}

export async function ensureCollection(name = COLLECTION_V1, dim = EMBED_DIMENSION): Promise<void> {
    const qc = qdrant();
    const exists = await qc.collectionExists(name);
    if (!exists.exists) {
        await qc.createCollection(name, {
            vectors: { size: dim, distance: "Cosine" },
        });
    }
    const indexes: Array<[string, "keyword" | "datetime" | "float"]> = [
        ["label",        "keyword"],
        ["doc_id",       "keyword"],
        ["customer_id",  "keyword"],
        ["ship_country", "keyword"],
        ["order_date",   "datetime"],
        ["total_price",  "float"],
    ];
    for (const [field, schema] of indexes) {
        try {
            await qc.createPayloadIndex(name, { field_name: field, field_schema: schema });
        } catch (e) {
            if (!String(e).toLowerCase().includes("already exists")) throw e;
        }
    }
}

export type UpsertItem = {
    doc_id: string;
    vector: number[];
    payload: Record<string, unknown>;
};

export async function upsertDocs(items: UpsertItem[], collection = COLLECTION_V1): Promise<void> {
    if (items.length === 0) return;
    const BATCH = 200;
    const qc = qdrant();
    for (let i = 0; i < items.length; i += BATCH) {
        const slice = items.slice(i, i + BATCH);
        await qc.upsert(collection, {
            wait: true,
            points: slice.map(it => ({
                id: docIdToUuid(it.doc_id),
                vector: it.vector,
                payload: it.payload,
            })),
        });
    }
}

export function payloadFromDoc(p: DocPayload): Record<string, unknown> {
    const out: Record<string, unknown> = {
        doc_id: p.doc_id,
        label: p.label,
        text: p.text,
        word_count: p.word_count,
    };
    const optional = [
        "order_id","order_date","shipped_date","customer_id","customer_name",
        "employee_name","shipper_name","ship_country","ship_city","ship_region",
        "total_price","report_category","report_period",
    ] as const;
    for (const k of optional) {
        const v = (p as any)[k];
        if (v !== null && v !== undefined) out[k] = v;
    }
    if (p.products.length > 0) out.products = p.products;
    return out;
}

export async function search(query: string, k = 5, collection = COLLECTION_V1): Promise<Hit[]> {
    const [vec] = await embed(query);
    if (!vec) throw new Error("embed returned empty");
    const r = await qdrant().query(collection, {
        query: vec,
        limit: k,
        with_payload: true,
    });
    return r.points.map(p => ({
        doc_id: String(p.payload?.doc_id ?? ""),
        score: p.score,
        payload: p.payload as Record<string, unknown>,
    }));
}