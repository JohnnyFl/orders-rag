import type { State } from "../state";

export async function refuseNode(_state: State): Promise<Partial<State>> {
    return {
        answer: "I can only help with questions about our invoices, shipping orders, purchase orders, and stock reports. Try asking about a customer, country, date range, product, or order ID.",
    };
}