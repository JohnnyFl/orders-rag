import { z } from "zod";
import { parseWithZod, DEFAULT_CHAT_MODEL } from "../clients/openai";
import { search, searchHybrid, COLLECTION_V1, COLLECTION_V2_HYBRID, type Hit  } from "../clients/qdrant";
import { rerank as doRerank } from "../clients/cohere";
import { prompts } from "../prompt-registry";


export type AnswerOpts = {
    topK?: number;
    collection?: string;
    hybrid?: boolean;
    useRerank?: boolean;
    label?: string | null;
};

export const Citation = z.object({
    doc_id: z.string().describe("doc_id of a supporting document"),
    note: z.string().nullish().describe("One sentence on what this doc contributed"),
});
export type CitationData = z.infer<typeof Citation>;

export const RAGResponse = z.object({
    answer: z.string().describe("The answer or a refusal explanation"),
    citations: z.array(Citation).default([]),
    needs_aggregation: z.boolean().describe("True if counting/summing across many docs is required"),
    no_relevant_docs: z.boolean().describe("True if no document is relevant"),
});
export type RAGResponse = z.infer<typeof RAGResponse>;

function formatContext(hits: Hit[]): string {
    return hits.map(h => {
        const text = String(h.payload.text ?? "").slice(0, 800);
        return `--- doc_id=${h.doc_id} label=${h.payload.label} ---\n${text}`;
    }).join("\n\n");
}

export type AnswerResult = { response: RAGResponse; hits: Hit[] };

export async function answer(question: string, opts: AnswerOpts = {}): Promise<AnswerResult> {
    const topK = opts.topK ?? 5;
    const fetchK = opts.useRerank ? Math.min(topK * 4, 50) : topK;
    const collection = opts.collection ?? (opts.hybrid ? COLLECTION_V2_HYBRID : COLLECTION_V1);

    let hits = opts.hybrid
        ? await searchHybrid(question, fetchK, collection, opts.label ?? null)
        : await search(question, fetchK, collection, opts.label ?? null);

    if (opts.useRerank && hits.length > topK) {
        const docs = hits.map(h => String(h.payload.text ?? "").slice(0, 800));
        const ranked = await doRerank(question, docs, topK);
        hits = ranked.map(([idx, score]) => ({ ...hits[idx]!, score }));
    }
    const sys = prompts().render("qa_agent", {
        context: formatContext(hits),
        question,
    });
    const { data } = await parseWithZod({ schema: RAGResponse, name: "rag_response", system: sys, user: "Produce the structured answer now." });
    return { response: data, hits };
}