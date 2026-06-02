import { z } from "zod";

export const RAGUsedContext = z.object({
    id: z.string().describe("doc_id used"),
    description: z.string().describe("One sentence on what this doc contributed"),
});

export const FinalResponseSchema = z.object({
    answer: z.string().describe("Final answer"),
    references: z.array(RAGUsedContext).describe("Every doc you used"),
});
export type FinalResponse = z.infer<typeof FinalResponseSchema>;