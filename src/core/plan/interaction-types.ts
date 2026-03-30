import type {
  PlanQuestionOption,
  PlanQuestionRequest,
} from "./plan-bus.ts";

/** 解析出的计划交互 */
export type ParsedPlanInteraction =
  | { type: "question"; data: PlanQuestionRequest }
  | { type: "preview"; data: { title: string; planMarkdown: string } };

/** 计划交互伪工具的最小结构 */
export interface PlanInteractionToolCall {
  /** 工具名称 */
  name: string;
  /** 工具参数 */
  args?: unknown;
}

/** 原始函数调用中的 function 负载 */
export interface RawToolFunctionPayload {
  /** 函数名称 */
  name?: unknown;
  /** 函数字符串参数 */
  arguments?: unknown;
}

/** 原始工具调用结构 */
export interface RawPlanInteractionToolCall {
  /** 顶层工具名称 */
  name?: unknown;
  /** 顶层参数对象 */
  args?: unknown;
  /** 顶层 arguments 字段 */
  arguments?: unknown;
  /** function 结构 */
  function?: RawToolFunctionPayload;
}

/** 常见英文计划标题到中文标题的映射 */
export const PLAN_HEADING_REPLACEMENTS: Array<{
  pattern: RegExp;
  replacement: string;
}> = [
  { pattern: /^(#{2,6}\s*)Summary\s*:?\s*$/i, replacement: "$1概要" },
  { pattern: /^(#{2,6}\s*)Key Changes\s*:?\s*$/i, replacement: "$1关键改动" },
  {
    pattern: /^(#{2,6}\s*)Implementation Changes\s*:?\s*$/i,
    replacement: "$1实现改动",
  },
  { pattern: /^(#{2,6}\s*)Test Plan\s*:?\s*$/i, replacement: "$1测试计划" },
  { pattern: /^(#{2,6}\s*)Assumptions\s*:?\s*$/i, replacement: "$1前提假设" },
];

/** 计划问题伪工具名集合 */
export const PLAN_QUESTION_TOOL_NAMES = new Set(["plan_question"]);

/** 计划预览伪工具名集合 */
export const PLAN_PREVIEW_TOOL_NAMES = new Set([
  "plan_preview",
  "proposed_plan",
]);

/** 计划问题字段别名 */
export const PLAN_QUESTION_FIELD_KEYS = {
  title: ["title", "name", "heading"],
  question: ["question", "prompt", "content", "message", "text"],
  options: ["options", "choices", "items", "answers", "suggestions"],
} as const;

/** 计划交互常见嵌套负载字段 */
export const PLAN_INTERACTION_NESTED_KEYS = [
  "input",
  "payload",
  "data",
  "arguments",
  "params",
] as const;

/** 计划预览数据结构 */
export interface PlanPreviewData {
  /** 预览标题 */
  title: string;
  /** 计划 Markdown 内容 */
  planMarkdown: string;
}

/** 计划问题选项类型复用导出 */
export type { PlanQuestionOption, PlanQuestionRequest };
