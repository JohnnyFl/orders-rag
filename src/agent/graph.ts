import { StateGraph, START, END } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { StateAnnotation, type State } from "./state";
import { routerNode } from "./nodes/router";
import { expandNode } from "./nodes/expand";
import { agentNode } from "./nodes/agent";
import { refuseNode } from "./nodes/refuse";
import { aggregateStubNode } from "./nodes/aggregate_stub";
import { searchDocuments } from "./tools/search";
import {getDocumentById} from "./tools/get_by_id.ts";
import {aggregateDocuments} from "./tools/aggregate.ts";

const toolNode = new ToolNode([searchDocuments, getDocumentById, aggregateDocuments]);

function routeAfterRouter(state: State): "refuse" | "expand" {
    if (!state.relevant) return "refuse";
    return "expand";  // aggregation flag now flows into the agent prompt
}

function routeAfterAgent(state: State): "tool_node" | typeof END {
    if (state.final_answer) return END;
    if (state.iteration > 3) return END;
    const last = state.messages.at(-1);
    if (last && "tool_calls" in last && Array.isArray((last as any).tool_calls) && (last as any).tool_calls.length > 0) {
        return "tool_node";
    }
    return END;
}

export function buildGraph() {
    return new StateGraph(StateAnnotation)
        .addNode("router", routerNode)
        .addNode("expand", expandNode)
        .addNode("agent", agentNode)
        .addNode("tool_node", toolNode)
        .addNode("refuse", refuseNode)
        .addNode("aggregate_stub", aggregateStubNode)
        .addEdge(START, "router")
        .addConditionalEdges("router", routeAfterRouter, {
            refuse: "refuse",
            aggregate_stub: "aggregate_stub",
            expand: "expand",
        })
        .addEdge("expand", "agent")
        .addConditionalEdges("agent", routeAfterAgent, {
            tool_node: "tool_node",
            [END]: END,
        })
        .addEdge("tool_node", "agent")
        .addEdge("refuse", END)
        .addEdge("aggregate_stub", END)
        .compile();
}
