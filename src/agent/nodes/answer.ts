import { answer as ragAnswer } from "../../rag/pipeline";
import type { State } from "../state";

export async function answerNode(state: State): Promise<Partial<State>> {
    const q = state.expanded_queries[0] ?? state.question;
    const { response, hits } = await ragAnswer(q, { hybrid: true, label: state.label_hint });
    return {
        answer: response.answer,
        citations: response.citations,
        hits: hits.map(h => ({ doc_id: h.doc_id, score: h.score, payload: h.payload })),
    };
}