import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { qdrant, COLLECTION_V2_HYBRID } from "../../clients/qdrant";

export const getDocumentById = tool(
    async ({ doc_id }: { doc_id: string }): Promise<string> => {
        const r: any = await qdrant().scroll(COLLECTION_V2_HYBRID, {
            filter: { must: [{ key: "doc_id", match: { value: doc_id } }] } as any,
            limit: 1,
            with_payload: true,
            with_vector: false,
        });
        if (!r.points || r.points.length === 0) return `No document with doc_id=${doc_id}`;
        return JSON.stringify(r.points[0].payload, null, 2);
    },
    {
        name: "get_document_by_id",
        description: "Fetch the full text and structured fields of one document by doc_id. Use when you already know the doc_id.",
        schema: z.object({ doc_id: z.string() }),
    }
);