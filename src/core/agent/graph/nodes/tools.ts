import { ThinkingStatus } from "../../../types.ts";
import { AGENT_STATUS_TEXT } from "../../../config/agent-config.ts";
import { executeToolCalls } from "../../tool-calls.ts";
import type { AgentContext } from "../../helpers.ts";
import type { AgentGraphState } from "../state.ts";
import type { AgentGraphDeps } from "../deps.ts";

/** 构造 executeToolCalls 需要的 AgentContext */
function buildToolContext(
  state: AgentGraphState,
  deps: AgentGraphDeps
): AgentContext {
  return {
    messageBus: deps.messageBus,
    confirmBus: deps.confirmBus,
    todoBus: deps.todoBus,
    contextBus: deps.contextBus,
    config: deps.config,
    chatMessages: state.messages,
    debugMode: deps.isDebugMode(),
    mode: deps.getMode(),
    tools: deps.getTools(),
    executionState: deps.executionState,
  };
}

/**
 * 工具执行节点：把模型上一轮请求的 tool_calls 全部执行，
 * 结果以 ToolMessage 形式追加到 messages。
 */
export function createToolsNode(deps: AgentGraphDeps) {
  return async (state: AgentGraphState): Promise<Partial<AgentGraphState>> => {
    const response = state.messages[state.messages.length - 1] as any;
    await executeToolCalls(buildToolContext(state, deps), response);

    if (!deps.getAbortController()?.signal.aborted) {
      deps.messageBus.setThinkingStatus(
        ThinkingStatus.WAITING,
        AGENT_STATUS_TEXT.WAITING_AI
      );
    }
    return { messages: state.messages };
  };
}
