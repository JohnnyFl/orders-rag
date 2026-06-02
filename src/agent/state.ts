import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { Label } from "../schema";
import type { CitationData } from "../rag/pipeline";

export const StateAnnotation = Annotation.Root({
    // Inputs
    question: Annotation<string>(),
    thread_id: Annotation<string>({ default: () => "", reducer: (a, b) => b ?? a }),

    // Expansion
    expanded_queries: Annotation<string[]>({ default: () => [], reducer: (a, b) => b ?? a }),

    // Router output (Phase 12 fills these)
    relevant: Annotation<boolean>({ default: () => true, reducer: (a, b) => b ?? a }),
    needs_aggregation: Annotation<boolean>({ default: () => false, reducer: (a, b) => b ?? a }),
    label_hint: Annotation<Label | null>({ default: () => null, reducer: (a, b) => b ?? a }),

    // Retrieval / messages
    hits: Annotation<Array<{ doc_id: string; score: number; payload: Record<string, unknown> }>>({
        default: () => [],
        reducer: (a, b) => [...a, ...b],   // append slices
    }),
    messages: Annotation<BaseMessage[]>({
        default: () => [],
        reducer: (a, b) => [...a, ...b],
    }),
    iteration: Annotation<number>({ default: () => 0, reducer: (_a, b) => b }),
    final_answer: Annotation<boolean>({ default: () => false, reducer: (a, b) => b ?? a }),

    // Output
    answer: Annotation<string>({ default: () => "", reducer: (_a, b) => b }),
    citations: Annotation<CitationData[]>({ default: () => [], reducer: (_a, b) => b }),
    trace_id: Annotation<string>({ default: () => "", reducer: (a, b) => b ?? a }),
});

export type State = typeof StateAnnotation.State;