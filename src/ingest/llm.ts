import { z } from "zod";
import { DocPayload, type Label, type DocPayload as DocPayloadType } from "../schema";
import { parseWithZod } from "../clients/openai";

const SYSTEM = `You are extracting structured fields from a business document.

The text contains structured data embedded in unstructured prose. Numbers may use spaces instead of decimal points:
"38 0" means 38.00, "1368 0" means 1368.00.

Rules:
- Lowercase strings unless they are proper names (people, companies).
- Dates must be ISO YYYY-MM-DD.
- If a field is NOT in the text, omit it from your response (do not invent).
- For total_price: the final document total, not a per-line total.
- For products: every product in the document, in order.`;

export async function extractLLM(text: string, label: Label): Promise<DocPayloadType> {
    const user = `Label: ${label}\n\nDocument:\n${text}`;
    const { data } = await parseWithZod({
        schema: DocPayload,
        name: "doc_payload",
        system: SYSTEM,
        user,
    });
    // Caller will overwrite doc_id, text, word_count, label.
    return { ...(data as DocPayloadType), label };
}