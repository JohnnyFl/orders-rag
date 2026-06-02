import { ChatOpenAI } from "@langchain/openai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import type { State } from "../state";
import { prompts } from "../../prompt-registry";
import { searchDocuments } from "../tools/search";
import { FinalResponseSchema } from "../models";

const llm = new ChatOpenAI({ model: "gpt-4.1-mini" });
const llmWithTools = llm.bindTools([searchDocuments, FinalResponseSchema], { tool_choice: "auto" });

export async function agentNode(state: State): Promise<Partial<State>> {
    const system = prompts().render("qa_agent_react", {
        needs_aggregation: state.needs_aggregation,
        label_hint: state.label_hint ?? "",
    });

    const messages = state.messages.length === 0
        ? [new SystemMessage(system), new HumanMessage(state.question)]
        : [new SystemMessage(system), ...state.messages];

    const resp = await llmWithTools.invoke(messages);
    const newMessages = state.messages.length === 0
        ? [new HumanMessage(state.question), resp]
        : [resp];

    const update: Partial<State> = {
        messages: newMessages,
        iteration: state.iteration + 1,
    };

    // Detect FinalResponse call
    const toolCalls = (resp as AIMessage).tool_calls ?? [];
    for (const tc of toolCalls) {
        if (tc.name === "FinalResponseSchema" || tc.name === "FinalResponse") {
            const args = tc.args as { answer: string; references: Array<{id: string; description: string}> };
            update.final_answer = true;
            update.answer = args.answer;
            update.citations = (args.references ?? []).map(r => ({ doc_id: r.id, note: r.description }));
        }
    }
    return update;
}