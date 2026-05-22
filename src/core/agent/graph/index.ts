import { StateGraph, START, END } from "@langchain/langgraph";
import { AgentStateAnnotation } from "./state.ts";
import { createPrepareNode } from "./nodes/prepare.ts";
import { createCompactionNode } from "./nodes/compaction.ts";
import { createModelNode } from "./nodes/model.ts";
import { createToolsNode } from "./nodes/tools.ts";
import { createPlanInteractNode } from "./nodes/plan-interact.ts";
import { createRouteAfterModel, MODEL_ROUTE_MAP } from "./routes.ts";
import type { AgentGraphDeps } from "./deps.ts";

/** 编译后的 Agent 图实例类型 */
export type AgentGraph = ReturnType<typeof buildAgentGraph>;

/**
 * 构建 Agent 主循环图。
 * 拓扑：START → prepare → model → (tools|plan_interact|END)
 *                                       ↓        ↓
 *                                   compaction  model/tools/END
 *                                       ↓
 *                                     model
 */
export function buildAgentGraph(deps: AgentGraphDeps) {
  const graph = new StateGraph(AgentStateAnnotation)
    .addNode("prepare", createPrepareNode(deps))
    .addNode("compaction", createCompactionNode(deps))
    .addNode("model", createModelNode(deps))
    .addNode("tools", createToolsNode(deps))
    .addNode("plan_interact", createPlanInteractNode(deps), {
      ends: ["model", "tools", END],
    })
    .addEdge(START, "prepare")
    .addEdge("prepare", "compaction")
    .addEdge("compaction", "model")
    .addConditionalEdges(
      "model",
      createRouteAfterModel(deps),
      MODEL_ROUTE_MAP
    )
    .addEdge("tools", "compaction");

  return graph.compile();
}

export type { AgentGraphDeps } from "./deps.ts";
export type { AgentGraphState } from "./state.ts";
