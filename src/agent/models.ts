import { z } from "zod";
import { tool } from "@langchain/core/tools";

export const RAGUsedContext = z.object({
    id: z.string().describe("doc_id used"),
    description: z.string().describe("One sentence on what this doc contributed"),
});

export const FinalResponseSchema = z.object({
    answer: z.string().describe("Final answer"),
    references: z.array(RAGUsedContext).describe("Every doc you used"),
});
export type FinalResponse = z.infer<typeof FinalResponseSchema>;

export const FinalResponseTool = tool(
    async (_: FinalResponse) => "done",
    {
        name: "FinalResponse",
        description: "Call this when you have the final answer to return to the user.",
        schema: FinalResponseSchema,
    }
);