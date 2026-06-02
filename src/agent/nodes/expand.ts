import { z } from "zod";
import { parseWithZod } from "../../clients/openai";
import { prompts } from "../../prompt-registry";
import type { State } from "../state";

const Expansion = z.object({
    statements: z.array(z.string()).min(1).describe("One statement per intent"),
});

export async function expandNode(state: State): Promise<Partial<State>> {
    const system = prompts().render("query_expansion", { question: state.question });
    const { data } = await parseWithZod({
        schema: Expansion,
        name: "query_expansion",
        system,
        user: "Produce the statements now.",
    });
    return { expanded_queries: data.statements.length ? data.statements : [state.question] };
}