import { END } from "@langchain/langgraph";
import { AgentMode } from "../../types.ts";
import type { AgentGraphState } from "./state.ts";
import type { AgentGraphDeps } from "./deps.ts";

/** 模型节点完成后的下一步标签 */
export type ModelRoute = "tools" | "plan_interact" | "end";

/**
 * 模型节点之后的路由：
 * - 中断 → 结束；
 * - plan 模式 → 总是进入 plan_interact（节点内部再决定后续）；
 * - 其他模式 → 有 tool_calls 走 tools，否则结束。
 */
export function createRouteAfterModel(deps: AgentGraphDeps) {
  return (state: AgentGraphState): ModelRoute => {
    if (deps.getAbortController()?.signal.aborted) {
      return "end";
    }
    if (deps.getMode() === AgentMode.PLAN) {
      return "plan_interact";
    }

    const lastMessage = state.messages[state.messages.length - 1] as any;
    const hasToolCalls = lastMessage?.tool_calls?.length > 0;
    return hasToolCalls ? "tools" : "end";
  };
}

/** 用于 addConditionalEdges 的路由出口映射 */
export const MODEL_ROUTE_MAP = {
  tools: "tools",
  plan_interact: "plan_interact",
  end: END,
} as const;
