import {OpenAI} from "openai";
import {zodResponseFormat} from "openai/helpers/zod.js"
import type {z, ZodType} from "zod"
import { wrapOpenAI } from "langsmith/wrappers";
import { traceable } from 'langsmith/traceable';

export const DEFAULT_CHAT_MODEL = "gpt-5.4-mini"
export const DEFAULT_EMBED_MODEL = "text-embedding-3-small"
export const EMBED_DIMENSION = "1536"

export const openai = wrapOpenAI(new OpenAI())

export const parseWithZod = traceable(async function parseWithZod<T extends z.ZodTypeAny>(opts: {
    schema: T;
    name: string;
    system: string;
    user: string;
    model?: string;
}): Promise<{data: z.infer<T>; usage: OpenAI.Completions.CompletionUsage | null}> {
    const resp = await openai.chat.completions.parse({
        model: opts.model ?? DEFAULT_CHAT_MODEL,
        messages: [
            {role: "system", content: opts.system},
            {role: "user", content: opts.user},
        ],
        response_format: zodResponseFormat(opts.schema, opts.name)
    });
    const parsed = resp.choices[0]?.message.parsed
    if (!parsed) throw new Error("openai parse: no parsed result")
    return {data: parsed as z.infer<T>, usage: resp.usage ?? null}
})

export async function embed(input: string | string[], model = DEFAULT_EMBED_MODEL):
Promise<number[][]> {
    const inputs = typeof input === "string" ? [input] : input;
    if (inputs.length === 0) return [];
    const BATCH = 96;
    const out: number[][] = [];
    for (let i = 0; i < inputs.length; i += BATCH) {
        const slice = inputs.slice(i, i + BATCH);
        const resp = await openai.embeddings.create({ model, input: slice });
        for (const d of resp.data) out.push(d.embedding);
    }
    return out;
}