import { HumanMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { AgentMode } from "../types.ts";
import type { AgentModeValue } from "../types.ts";
import type { MessageBus } from "../message-bus.ts";
import type { PlanBus } from "../plan/plan-bus.ts";
import {
  buildPlanInteractionContent,
  buildPlanQuestionSummary,
  parsePlanInteraction,
  parsePlanInteractionFromRawToolCalls,
  parsePlanInteractionFromToolCalls,
} from "../plan/interaction-parser.ts";

/** 计划模式处理结果 */
export type PlanModeAction = "continue" | "break";

/** Agent 计划模式处理上下文 */
export interface AgentPlanModeContext {
  /** 是否开启调试模式 */
  debugMode: boolean;
  /** 消息总线 */
  readonly messageBus: MessageBus;
  /** 计划交互总线 */
  readonly planBus: PlanBus;
  /** 当前消息历史 */
  chatMessages: BaseMessage[];
  /** 获取响应文本内容 */
  getResponseContent(response: any): string;
  /** 开启新的助手轮次 */
  beginAssistantTurn(): void;
  /** 切换 Agent 工作模式 */
  setMode(mode: AgentModeValue): void;
}

/** 给计划模式的占位文本附加调试信息 */
function appendPlanDebug(
  messageBus: MessageBus,
  debugMode: boolean,
  rawContent: string
): void {
  if (!debugMode) {
    return;
  }
  messageBus.appendDebugToLastBlock(
    JSON.stringify({ planModeRawContent: rawContent }, null, 2)
  );
}

/** 清空响应中的工具调用，避免误进入真实工具执行链路 */
function clearResponseToolCalls(response: any): void {
  response.tool_calls = [];
  if (Array.isArray(response?.additional_kwargs?.tool_calls)) {
    response.additional_kwargs.tool_calls = [];
  }
}

/** 推进计划模式中的追问回答 */
function continuePlanConversation(
  ctx: AgentPlanModeContext,
  displayText: string,
  answer: string
): void {
  ctx.messageBus.user(displayText);
  ctx.chatMessages.push(new HumanMessage(answer));
  ctx.beginAssistantTurn();
}

/** 归一化计划模式响应，兼容模型误输出的计划伪工具调用 */
export function normalizePlanModeResponse(
  ctx: Pick<AgentPlanModeContext, "getResponseContent">,
  response: any
): void {
  const content = ctx.getResponseContent(response).trim();
  const parsedFromContent = parsePlanInteraction(content);
  if (parsedFromContent) {
    clearResponseToolCalls(response);
    return;
  }

  const parsedFromToolCalls = parsePlanInteractionFromToolCalls(
    Array.isArray(response?.tool_calls) ? response.tool_calls : []
  );
  const parsedFromRawToolCalls = parsePlanInteractionFromRawToolCalls(
    response?.additional_kwargs?.tool_calls
  );
  const parsedInteraction = parsedFromToolCalls || parsedFromRawToolCalls;
  if (!parsedInteraction) {
    return;
  }

  const interactionContent = buildPlanInteractionContent(parsedInteraction);
  response.content = content ? `${content}\n\n${interactionContent}` : interactionContent;
  clearResponseToolCalls(response);
}

/** 处理计划模式下的结构化提问 */
async function handlePlanQuestion(
  ctx: AgentPlanModeContext,
  content: string
): Promise<PlanModeAction> {
  const parsedInteraction = parsePlanInteraction(content);
  if (!parsedInteraction || parsedInteraction.type !== "question") {
    return "continue";
  }

  ctx.messageBus.ai(buildPlanQuestionSummary(parsedInteraction.data));
  appendPlanDebug(ctx.messageBus, ctx.debugMode, content);

  const answer = await ctx.planBus.requestQuestion(parsedInteraction.data);
  continuePlanConversation(ctx, answer.displayText, answer.answer);
  return "continue";
}

/** 处理计划模式下的计划预览 */
async function handlePlanPreview(
  ctx: AgentPlanModeContext,
  content: string
): Promise<PlanModeAction> {
  const parsedInteraction = parsePlanInteraction(content);
  if (!parsedInteraction || parsedInteraction.type !== "preview") {
    return "break";
  }

  const { title, planMarkdown } = parsedInteraction.data;
  ctx.messageBus.plan(title, planMarkdown);
  appendPlanDebug(ctx.messageBus, ctx.debugMode, content);

  const result = await ctx.planBus.requestPlanPreview(title, planMarkdown);
  if (result.action === "execute") {
    ctx.messageBus.user("确认执行当前计划");
    ctx.chatMessages.push(
      new HumanMessage("我已确认当前计划，请立即切换到执行阶段并开始实现。")
    );
    ctx.setMode(AgentMode.BUILD);
    ctx.beginAssistantTurn();
    return "continue";
  }

  return "break";
}

/** 处理计划模式下的模型文本响应 */
export async function handlePlanModeResponse(
  ctx: AgentPlanModeContext,
  response: any
): Promise<PlanModeAction> {
  const content = ctx.getResponseContent(response).trim();
  if (!content) {
    return response.tool_calls?.length > 0 ? "continue" : "break";
  }

  const parsedInteraction = parsePlanInteraction(content);
  if (!parsedInteraction) {
    ctx.messageBus.ai(content);
    appendPlanDebug(ctx.messageBus, ctx.debugMode, content);
    return response.tool_calls?.length > 0 ? "continue" : "break";
  }

  if (parsedInteraction.type === "question") {
    return handlePlanQuestion(ctx, content);
  }
  return handlePlanPreview(ctx, content);
}
