import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { searchHybrid, COLLECTION_V2_HYBRID } from "../../clients/qdrant";

export const searchDocuments = tool(
    async (args: { query: string; label?: string; top_k?: number }): Promise<string> => {
        const topK = Math.min(args.top_k ?? 5, 20);
        const hits = await searchHybrid(args.query, topK, COLLECTION_V2_HYBRID, args.label || null);
        if (hits.length === 0) return `No documents found for: ${args.query}`;
        return hits.map(h => {
            const txt = String(h.payload.text ?? "").slice(0, 500);
            return `--- doc_id=${h.doc_id} label=${h.payload.label} ---\n${txt}`;
        }).join("\n\n");
    },
    {
        name: "search_documents",
        description: "Hybrid search (dense + BM25) over business documents (invoices, shipping orders, purchase orders, reports).",
        schema: z.object({
            query: z.string().describe("Search query"),
            label: z.enum(["shipping_order","invoice","purchase_order","report"]).optional().describe("Optional filter by document type"),
            top_k: z.number().int().min(1).max(20).optional().describe("Number of results (default 5)"),
        }),
    }
);