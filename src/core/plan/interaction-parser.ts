import type {
  ParsedPlanInteraction,
  PlanInteractionToolCall,
  PlanPreviewData,
  PlanQuestionRequest,
} from "./interaction-types.ts";
import {
  PLAN_PREVIEW_TOOL_NAMES,
  PLAN_QUESTION_TOOL_NAMES,
} from "./interaction-types.ts";
import {
  normalizePlanPreviewData,
  normalizeRawToolCall,
} from "./interaction-normalizers.ts";
import { parseJsonRecord, extractTagContent } from "./interaction-json.ts";
import { normalizePlanQuestionRequest } from "./question-normalizer.ts";

/** 判断是否为计划交互伪工具名 */
export function isPlanInteractionToolName(name: string): boolean {
  return PLAN_QUESTION_TOOL_NAMES.has(name) || PLAN_PREVIEW_TOOL_NAMES.has(name);
}

/** 从伪工具参数中解析计划交互 */
export function parsePlanInteractionFromToolCalls(
  toolCalls: PlanInteractionToolCall[]
): ParsedPlanInteraction | null {
  for (const toolCall of toolCalls) {
    if (!isPlanInteractionToolName(toolCall.name)) {
      continue;
    }

    if (PLAN_QUESTION_TOOL_NAMES.has(toolCall.name)) {
      const payload =
        typeof toolCall.args === "string"
          ? parseJsonRecord(toolCall.args)
          : toolCall.args && typeof toolCall.args === "object"
            ? (toolCall.args as Record<string, unknown>)
            : null;
      const parsedQuestion = payload
        ? normalizePlanQuestionRequest(payload)
        : null;
      if (parsedQuestion) {
        return { type: "question", data: parsedQuestion };
      }
      continue;
    }

    const parsedPreview = normalizePlanPreviewData(toolCall.args);
    if (parsedPreview) {
      return { type: "preview", data: parsedPreview };
    }
  }

  return null;
}

/** 从原始工具调用数组中解析计划交互 */
export function parsePlanInteractionFromRawToolCalls(
  rawToolCalls: unknown
): ParsedPlanInteraction | null {
  if (!Array.isArray(rawToolCalls)) {
    return null;
  }

  const toolCalls = rawToolCalls
    .map(normalizeRawToolCall)
    .filter((toolCall): toolCall is PlanInteractionToolCall => toolCall !== null);
  if (toolCalls.length === 0) {
    return null;
  }

  return parsePlanInteractionFromToolCalls(toolCalls);
}

/** 将计划交互重新编码为文本标签 */
export function buildPlanInteractionContent(
  interaction: ParsedPlanInteraction
): string {
  if (interaction.type === "question") {
    return [
      "<plan_question>",
      JSON.stringify(interaction.data, null, 2),
      "</plan_question>",
    ].join("\n");
  }

  return [
    "<proposed_plan>",
    interaction.data.planMarkdown,
    "</proposed_plan>",
  ].join("\n");
}

/** 解析计划问题结构 */
export function parsePlanQuestion(content: string): PlanQuestionRequest | null {
  const rawQuestion = extractTagContent(content, "plan_question");
  if (!rawQuestion) {
    return null;
  }
  const parsed = parseJsonRecord(rawQuestion);
  return parsed ? normalizePlanQuestionRequest(parsed) : null;
}

/** 解析计划预览结构 */
export function parsePlanPreview(content: string): PlanPreviewData | null {
  const planMarkdown = extractTagContent(content, "proposed_plan");
  if (!planMarkdown) {
    return null;
  }
  return normalizePlanPreviewData({ planMarkdown });
}

/** 解析计划模式返回的结构化交互 */
export function parsePlanInteraction(
  content: string
): ParsedPlanInteraction | null {
  const parsedQuestion = parsePlanQuestion(content);
  if (parsedQuestion) {
    return { type: "question", data: parsedQuestion };
  }

  const parsedPreview = parsePlanPreview(content);
  if (parsedPreview) {
    return { type: "preview", data: parsedPreview };
  }

  return null;
}

/** 构建问题交互的占位摘要 */
export function buildPlanQuestionSummary(
  request: PlanQuestionRequest
): string {
  return [
    `需要你确认一个计划问题：${request.title}`,
    request.question,
    "已打开选项面板，请直接选择一个选项，或使用最后一项自定义输入。",
  ].join("\n");
}

/** 构建计划预览交互的占位摘要 */
export function buildPlanPreviewSummary(title: string): string {
  return `${title}已生成，已打开预览面板。你可以确认执行，或输入修改意见。`;
}
