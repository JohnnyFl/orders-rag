import type { State } from "../state";

export async function aggregateStubNode(_state: State): Promise<Partial<State>> {
    return {
        answer: "This question requires aggregation across many documents. The aggregation tool is being added; please rephrase as a specific lookup (e.g. 'show me invoices for customer ALFKI in 2017').",
    };
}