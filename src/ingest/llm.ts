import { z } from "zod";
import { DocPayload, type Label, type DocPayload as DocPayloadType } from "../schema";
import { parseWithZod } from "../clients/openai";
import { prompts } from "../prompt-registry.ts";

export async function extractLLM(text: string, label: Label): Promise<DocPayloadType> {
    const system = prompts().render("extractor");
    const user = `Label: ${label}\n\nDocument:\n${text}`;
    const { data } = await parseWithZod({ schema: DocPayload, name: "doc_payload", system, user });
    return { ...data, label };
}