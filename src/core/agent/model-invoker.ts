import type { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import { AgentMode, ThinkingStatus } from "../types.ts";
import type { AgentModeValue } from "../types.ts";
import type { MessageBus } from "../message-bus.ts";
import {
  AGENT_API_MAX_ATTEMPTS,
  AGENT_API_RETRY_BASE_DELAY_MS,
  AGENT_API_RETRY_MAX_DELAY_MS,
} from "../config/agent-config.ts";
import { invokeModelResponse, streamModelResponse } from "./stream.ts";
import { getModelRetryDecision, waitForRetryDelay } from "./retry.ts";

/** Agent 模型调用上下文 */
export interface AgentModelInvokeContext {
  /** 中断控制器 */
  abortController: AbortController | null;
  /** 消息总线 */
  readonly messageBus: MessageBus;
  /** 当前消息历史 */
  chatMessages: BaseMessage[];
  /** 工作模式 */
  mode: AgentModeValue;
  /** 是否启用流式输出 */
  streamEnabled: boolean;
  /** 是否开启调试模式 */
  debugMode: boolean;
  /** 获取已绑定工具的模型实例 */
  getModel(): ReturnType<ChatOpenAI["bindTools"]>;
}

/** 按当前模式执行一次模型请求 */
async function invokeModelOnce(
  ctx: AgentModelInvokeContext,
  signal: AbortSignal
): Promise<any> {
  if (ctx.mode === AgentMode.PLAN) {
    const response = await ctx.getModel().invoke(ctx.chatMessages, { signal });
    ctx.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
    return response;
  }

  return ctx.streamEnabled
    ? await streamModelResponse(
        ctx.messageBus,
        ctx.debugMode,
        ctx.getModel(),
        ctx.chatMessages,
        signal
      )
    : await invokeModelResponse(
        ctx.messageBus,
        ctx.debugMode,
        ctx.getModel(),
        ctx.chatMessages,
        signal
      );
}

/** 在临时性平台错误下自动重试模型请求 */
export async function invokeModelWithRetry(
  ctx: AgentModelInvokeContext
): Promise<any> {
  const signal = ctx.abortController?.signal;
  if (!signal) {
    throw new Error("模型请求尚未初始化");
  }

  for (let attempt = 1; attempt <= AGENT_API_MAX_ATTEMPTS; attempt++) {
    try {
      return await invokeModelOnce(ctx, signal);
    } catch (error) {
      const retryDecision = getModelRetryDecision(error, attempt, {
        maxAttempts: AGENT_API_MAX_ATTEMPTS,
        baseDelayMs: AGENT_API_RETRY_BASE_DELAY_MS,
        maxDelayMs: AGENT_API_RETRY_MAX_DELAY_MS,
      });

      if (!retryDecision.shouldRetry) {
        throw error;
      }

      const retryIndex = attempt;
      const totalRetries = AGENT_API_MAX_ATTEMPTS - 1;
      const delaySeconds = Math.max(1, Math.ceil(retryDecision.delayMs / 1000));
      ctx.messageBus.warning(
        `模型服务暂时不可用（${retryDecision.reason}），正在自动重试（${retryIndex}/${totalRetries}），约 ${delaySeconds} 秒后继续。`
      );
      ctx.messageBus.setThinkingStatus(
        ThinkingStatus.THINKING,
        `模型暂时不可用，正在自动重试（${retryIndex}/${totalRetries}）...`
      );
      await waitForRetryDelay(retryDecision.delayMs, signal);
    }
  }

  throw new Error("模型请求重试失败");
}
