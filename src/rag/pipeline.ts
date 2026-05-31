import { z } from "zod";
import { parseWithZod, DEFAULT_CHAT_MODEL } from "../clients/openai";
import { search, type Hit } from "../clients/qdrant";

export const Citation = z.object({
    doc_id: z.string().describe("doc_id of a supporting document"),
    note: z.string().nullish().describe("One sentence on what this doc contributed"),
});

export const RAGResponse = z.object({
    answer: z.string().describe("The answer or a refusal explanation"),
    citations: z.array(Citation).default([]),
    needs_aggregation: z.boolean().describe("True if counting/summing across many docs is required"),
    no_relevant_docs: z.boolean().describe("True if no document is relevant"),
});
export type RAGResponse = z.infer<typeof RAGResponse>;

const SYSTEM = (context: string, question: string) => `You are a business analyst assistant answering questions about a company's operational records: invoices, shipping orders, purchase orders, and stock reports.

Use only the documents provided.

Rules:
- If aggregation is needed (count / sum / group across many docs), set needs_aggregation=true with a brief note. Do NOT invent a numeric total.
- If no document is relevant, set no_relevant_docs=true and answer with "I could not find a relevant document for that question."
- Otherwise answer concisely. Cite every doc you used in citations[] with its doc_id.

Documents:
${context}

Question: ${question}`;

function formatContext(hits: Hit[]): string {
    return hits.map(h => {
        const text = String(h.payload.text ?? "").slice(0, 800);
        return `--- doc_id=${h.doc_id} label=${h.payload.label} ---\n${text}`;
    }).join("\n\n");
}

export type AnswerResult = { response: RAGResponse; hits: Hit[] };

export async function answer(question: string, opts: { topK?: number; collection?: string } = {}): Promise<AnswerResult> {
    const hits = await search(question, opts.topK ?? 5, opts.collection);
    const sys = SYSTEM(formatContext(hits), question);
    const { data } = await parseWithZod({
        schema: RAGResponse,
        name: "rag_response",
        system: sys,
        user: "Produce the structured answer now.",
        model: DEFAULT_CHAT_MODEL,
    });
    return { response: data, hits };
}