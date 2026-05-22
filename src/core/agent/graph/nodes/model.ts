import { compactMessagesForContext } from "../../../context/compaction.ts";
import { ThinkingStatus, AgentMode } from "../../../types.ts";
import { AGENT_STATUS_TEXT } from "../../../config/agent-config.ts";
import { invokeModelWithRetry } from "../../model-invoker.ts";
import type { AgentModelInvokeContext } from "../../model-invoker.ts";
import {
  handleApiError,
  normalizeResponse,
  normalizeResponseToolCalls,
} from "../../tool-calls.ts";
import { normalizePlanModeResponse } from "../../plan-mode.ts";
import type { AgentGraphState } from "../state.ts";
import type { AgentGraphDeps } from "../deps.ts";

/** 提取响应文本内容（仅用于 plan 模式归一化） */
function getResponseContent(response: any): string {
  if (typeof response?.content === "string") return response.content;
  if (!response?.content) return "";
  return JSON.stringify(response.content);
}

/** 构造一份临时的模型调用上下文，复用既有 invokeModelWithRetry */
function buildInvokeContext(
  state: AgentGraphState,
  deps: AgentGraphDeps
): AgentModelInvokeContext {
  return {
    abortController: deps.getAbortController(),
    messageBus: deps.messageBus,
    chatMessages: state.messages,
    mode: deps.getMode(),
    streamEnabled: deps.isStreamEnabled(),
    debugMode: deps.isDebugMode(),
    getModel: () => deps.getModel(),
  };
}

/** 处理模型调用异常：被中断时静默退出，否则委托给原有错误处理 */
function handleInvokeError(
  error: unknown,
  signal: AbortSignal | undefined,
  deps: AgentGraphDeps
): void {
  if (signal?.aborted) {
    deps.messageBus.ai(AGENT_STATUS_TEXT.ABORTED);
    return;
  }
  deps.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
  handleApiError(deps.config, error);
}

/**
 * 模型调用节点：发起一次 LLM 请求，归一化响应后 push 到消息历史。
 */
export function createModelNode(deps: AgentGraphDeps) {
  return async (state: AgentGraphState): Promise<Partial<AgentGraphState>> => {
    const signal = deps.getAbortController()?.signal;
    if (signal?.aborted) {
      deps.messageBus.ai(AGENT_STATUS_TEXT.ABORTED);
      return { messages: state.messages };
    }

    deps.refreshSystemPrompt();
    deps.messageBus.setThinkingStatus(
      ThinkingStatus.THINKING,
      AGENT_STATUS_TEXT.THINKING
    );

    let response: any;
    try {
      response = await invokeModelWithRetry(buildInvokeContext(state, deps));
    } catch (error) {
      handleInvokeError(error, signal, deps);
      return { messages: state.messages };
    }

    compactMessagesForContext(state.messages);
    normalizeResponseToolCalls(response);
    if (deps.getMode() === AgentMode.PLAN) {
      normalizePlanModeResponse({ getResponseContent }, response);
    }
    state.messages.push(normalizeResponse(response));

    return { messages: state.messages };
  };
}
