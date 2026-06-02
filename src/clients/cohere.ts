import { CohereClientV2 } from "cohere-ai";

export const RERANK_MODEL = "rerank-v3.5";

let _client: CohereClientV2 | null = null;
function client(): CohereClientV2 {
    if (!_client) {
        const token = process.env.COHERE_API_KEY;
        if (!token) throw new Error("COHERE_API_KEY not set");
        _client = new CohereClientV2({ token });
    }
    return _client;
}

/** Returns [(index, score), ...] best-first; length = min(topN, docs.length). */
export async function rerank(query: string, docs: string[], topN = 5): Promise<Array<[number, number]>> {
    if (docs.length === 0) return [];
    const n = Math.min(topN, docs.length);
    const r = await client().rerank({
        model: RERANK_MODEL,
        query,
        documents: docs,
        topN: n,
    });
    return r.results.map(x => [x.index, x.relevanceScore] as [number, number]);
}