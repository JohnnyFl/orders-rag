import { z } from "zod";
import { parseWithZod } from "../../clients/openai";
import { prompts } from "../../prompt-registry";
import type { State } from "../state";
import type { Label } from "../../schema";

const Resp = z.object({
    relevant: z.boolean(),
    reason: z.string(),
    needs_aggregation: z.boolean(),
    label_hint: z.enum(["shipping_order","invoice","purchase_order","report",""]),
});

export async function routerNode(state: State): Promise<Partial<State>> {
    const system = prompts().render("intent_router", { question: state.question });
    const { data } = await parseWithZod({
        schema: Resp, name: "intent_router",
        system, user: "Classify the question.",
    });
    const out: Partial<State> = {
        relevant: data.relevant,
        needs_aggregation: data.needs_aggregation,
    };
    if (data.label_hint) out.label_hint = data.label_hint as Label;
    return out;
}