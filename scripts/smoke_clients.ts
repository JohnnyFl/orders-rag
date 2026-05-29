import {z} from "zod";
import {openai, parseWithZod, embed, DEFAULT_CHAT_MODEL} from "../src/clients/openai.ts";

const Greeting = z.object({
    hello: z.string().describe("Greeting word"),
    language: z.string().describe("Language of the greeting")
})

const r1 = await openai.chat.completions.create({
    model: DEFAULT_CHAT_MODEL,
    messages: [{role: "user", content: "Say 'hi' in one word."}]
})

console.log("raw: ", r1.choices[0]?.message.content)

const {data} = await parseWithZod({
    schema: Greeting,
    name: "greeting",
    system: "Respond with a greeting in the language the user asks for.",
    user: "Great me in French"
})

console.log("structured: ", data)

const vecs = await embed(["earphones", "shipping order to germany"]);
console.log(`embeddings: ${vecs.length} vectors, dim=${vecs[0]?.length}`);