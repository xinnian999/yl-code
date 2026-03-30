import { HumanMessage } from "@langchain/core/messages";
import { ThinkingStatus } from "../types.ts";
import type { PlanBus } from "../plan/plan-bus.ts";
import {
  AGENT_DURATION_UPDATE_INTERVAL_MS,
  AGENT_MAX_ITERATIONS,
  AGENT_STATUS_TEXT,
} from "../config/agent-config.ts";
import { compactMessagesForContext } from "../context/compaction.ts";
import type { AgentContext } from "./helpers.ts";
import { checkAndSummarize } from "./model.ts";
import {
  executeToolCalls,
  handleApiError,
  normalizeResponse,
  normalizeResponseToolCalls,
} from "./tool-calls.ts";
import type { AgentModelInvokeContext } from "./model-invoker.ts";
import { invokeModelWithRetry } from "./model-invoker.ts";
import type {
  AgentPlanModeContext,
  PlanModeAction,
} from "./plan-mode.ts";

/** Agent 主循环运行上下文 */
export interface AgentRunLoopContext
  extends AgentContext,
    AgentModelInvokeContext,
    AgentPlanModeContext {
  /** 计划交互总线 */
  readonly planBus: PlanBus;
  /** 刷新系统提示词 */
  refreshSystemPrompt(): void;
  /** 记录并上报耗时统计 */
  reportStats(startTime: number): void;
  /** 归一化计划模式响应 */
  normalizePlanResponse(response: any): void;
  /** 处理计划模式响应 */
  handlePlanModeResponse(response: any): Promise<PlanModeAction>;
}

/** 执行一次完整对话，支持多轮工具调用 */
export async function runAgentConversation(
  ctx: AgentRunLoopContext,
  query: string,
  fileContext = "",
  maxIterations: number | null = AGENT_MAX_ITERATIONS
): Promise<string> {
  const startTime = Date.now();
  ctx.abortController = new AbortController();
  ctx.confirmBus.resetSkipConfirm();
  ctx.planBus.resetWaitTime();
  compactMessagesForContext(ctx.chatMessages);
  ctx.executionState.recordUserTurn(query);
  ctx.refreshSystemPrompt();

  const durationTimer = setInterval(() => {
    const wait = ctx.confirmBus.getCurrentWaitTime() + ctx.planBus.getCurrentWaitTime();
    const elapsed = Date.now() - startTime - wait;
    if (elapsed >= 0) {
      ctx.messageBus.setLastAITotalDuration(elapsed);
    }
  }, AGENT_DURATION_UPDATE_INTERVAL_MS);

  let messageContent = query;
  if (fileContext) {
    messageContent = `${query}\n\n【用户引用的文件内容如下，请根据这些内容完成任务】${fileContext}`;
  }

  try {
    await checkAndSummarize(ctx);
    ctx.refreshSystemPrompt();
    ctx.chatMessages.push(new HumanMessage(messageContent));
    ctx.beginAssistantTurn();

    let iterationCount = 0;
    while (maxIterations === null || iterationCount < maxIterations) {
      iterationCount += 1;
      if (ctx.abortController.signal.aborted) {
        ctx.messageBus.ai(AGENT_STATUS_TEXT.ABORTED);
        break;
      }

      ctx.refreshSystemPrompt();
      ctx.messageBus.setThinkingStatus(
        ThinkingStatus.THINKING,
        AGENT_STATUS_TEXT.THINKING
      );

      let response: any;
      try {
        response = await invokeModelWithRetry(ctx);
      } catch (error) {
        if (ctx.abortController.signal.aborted) {
          ctx.messageBus.ai(AGENT_STATUS_TEXT.ABORTED);
          break;
        }
        ctx.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
        handleApiError(ctx.config, error);
      }

      compactMessagesForContext(ctx.chatMessages);
      normalizeResponseToolCalls(response);
      if (ctx.mode === "plan") {
        ctx.normalizePlanResponse(response);
      }
      ctx.chatMessages.push(normalizeResponse(response));

      if (ctx.mode === "plan") {
        const planAction = await ctx.handlePlanModeResponse(response);
        if (planAction === "continue") {
          if (!response.tool_calls || response.tool_calls.length === 0) {
            ctx.messageBus.setThinkingStatus(
              ThinkingStatus.WAITING,
              AGENT_STATUS_TEXT.WAITING_AI
            );
            continue;
          }
        } else {
          break;
        }
      }

      if (!response.tool_calls || response.tool_calls.length === 0) {
        break;
      }

      await executeToolCalls(ctx, response);
      if (iterationCount > 1) {
        await checkAndSummarize(ctx);
      }
      if (ctx.abortController.signal.aborted) {
        ctx.messageBus.ai(AGENT_STATUS_TEXT.ABORTED);
        break;
      }
      ctx.messageBus.setThinkingStatus(
        ThinkingStatus.WAITING,
        AGENT_STATUS_TEXT.WAITING_AI
      );
    }

    ctx.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
    if (!ctx.abortController?.signal.aborted) {
      ctx.todoBus.completeAll();
    }
    ctx.reportStats(startTime);
    compactMessagesForContext(ctx.chatMessages);

    const lastMessage = ctx.chatMessages[ctx.chatMessages.length - 1];
    return typeof lastMessage.content === "string" ? lastMessage.content : "";
  } finally {
    clearInterval(durationTimer);
  }
}
