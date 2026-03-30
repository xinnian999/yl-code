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
interface RawToolFunctionPayload {
  /** 函数名称 */
  name?: unknown;
  /** 函数字符串参数 */
  arguments?: unknown;
}

/** 原始工具调用结构 */
interface RawPlanInteractionToolCall {
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
const PLAN_HEADING_REPLACEMENTS: Array<{
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
const PLAN_QUESTION_TOOL_NAMES = new Set(["plan_question"]);

/** 计划预览伪工具名集合 */
const PLAN_PREVIEW_TOOL_NAMES = new Set(["plan_preview", "proposed_plan"]);

/** 计划问题字段别名 */
const PLAN_QUESTION_FIELD_KEYS = {
  title: ["title", "name", "heading"],
  question: ["question", "prompt", "content", "message", "text"],
  options: ["options", "choices", "items", "answers", "suggestions"],
} as const;

/** 计划交互常见嵌套负载字段 */
const PLAN_INTERACTION_NESTED_KEYS = [
  "input",
  "payload",
  "data",
  "arguments",
  "params",
] as const;

/** 从文本中提取指定标签包裹的内容 */
function extractTagContent(content: string, tag: string): string | null {
  const matcher = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, "i");
  const matched = content.match(matcher);
  if (!matched?.[1]) return null;
  return matched[1].trim();
}

/** 去掉可能包裹在外层的 Markdown 代码块 */
function stripCodeFence(content: string): string {
  const matched = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (!matched?.[1]) return content.trim();
  return matched[1].trim();
}

/** 解析 JSON 文本为对象 */
function parseJsonRecord(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(stripCodeFence(content)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** 从对象中按别名读取首个非空字符串字段 */
function getFirstStringField(
  raw: Record<string, unknown>,
  keys: readonly string[]
): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

/** 从对象中按别名读取首个数组字段 */
function getFirstArrayField(
  raw: Record<string, unknown>,
  keys: readonly string[]
): unknown[] {
  for (const key of keys) {
    const value = raw[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

/** 展开计划交互中可能被嵌套包裹的负载对象 */
function collectPayloadCandidates(
  raw: Record<string, unknown>
): Record<string, unknown>[] {
  const candidates: Record<string, unknown>[] = [raw];

  for (const key of PLAN_INTERACTION_NESTED_KEYS) {
    const value = raw[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      candidates.push(value as Record<string, unknown>);
      continue;
    }

    if (typeof value === "string") {
      const parsed = parseJsonRecord(value);
      if (parsed) {
        candidates.push(parsed);
      }
    }
  }

  return candidates;
}

/** 归一化单个计划问题选项 */
function normalizeQuestionOption(raw: unknown): PlanQuestionOption | null {
  if (typeof raw === "string" && raw.trim()) {
    return {
      label: raw.trim(),
      description: "",
    };
  }

  if (!raw || typeof raw !== "object") return null;

  const option = raw as Record<string, unknown>;
  const label = getFirstStringField(option, ["label", "title", "name", "value"]);
  if (!label) {
    return null;
  }

  return {
    label,
    description: getFirstStringField(option, ["description", "detail", "hint"]),
  };
}

/** 归一化计划问题载荷 */
function normalizePlanQuestionRequest(
  raw: Record<string, unknown>
): PlanQuestionRequest | null {
  for (const candidate of collectPayloadCandidates(raw)) {
    const title =
      getFirstStringField(candidate, PLAN_QUESTION_FIELD_KEYS.title) ||
      "计划问题确认";
    const question = getFirstStringField(
      candidate,
      PLAN_QUESTION_FIELD_KEYS.question
    );
    const options = getFirstArrayField(
      candidate,
      PLAN_QUESTION_FIELD_KEYS.options
    )
      .map(normalizeQuestionOption)
      .filter((option): option is PlanQuestionOption => option !== null);

    if (!question || options.length === 0) {
      continue;
    }

    return {
      title,
      question,
      options: options.slice(0, 5),
    };
  }

  return null;
}

/** 从 Markdown 中推断计划标题 */
function inferPlanTitle(planMarkdown: string): string {
  const firstLine = planMarkdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return "计划预览";
  if (firstLine.startsWith("#")) {
    return firstLine.replace(/^#+\s*/, "").trim() || "计划预览";
  }
  return "计划预览";
}

/** 将常见英文计划章节标题归一化为中文 */
function normalizePlanMarkdown(planMarkdown: string): string {
  return planMarkdown
    .split("\n")
    .map((line) => {
      for (const item of PLAN_HEADING_REPLACEMENTS) {
        if (item.pattern.test(line.trim())) {
          return line.replace(item.pattern, item.replacement);
        }
      }
      return line;
    })
    .join("\n");
}

/** 归一化计划预览载荷 */
function normalizePlanPreviewData(
  raw: unknown
): { title: string; planMarkdown: string } | null {
  const parsedStringPayload =
    typeof raw === "string" ? parseJsonRecord(raw) : null;
  const payload =
    parsedStringPayload ||
    (raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null);
  const rawPlanMarkdown = typeof raw === "string" && !parsedStringPayload
    ? raw
    : typeof payload?.planMarkdown === "string"
      ? payload.planMarkdown
      : typeof payload?.plan === "string"
        ? payload.plan
        : typeof payload?.content === "string"
          ? payload.content
          : typeof payload?.markdown === "string"
            ? payload.markdown
            : "";
  const planMarkdown = normalizePlanMarkdown(rawPlanMarkdown.trim());
  if (!planMarkdown) return null;

  const title = typeof payload?.title === "string" && payload.title.trim()
    ? payload.title.trim()
    : inferPlanTitle(planMarkdown);

  return { title, planMarkdown };
}

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

/** 将原始工具调用结构归一化为计划交互可识别的格式 */
function normalizeRawToolCall(
  raw: unknown
): PlanInteractionToolCall | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const toolCall = raw as RawPlanInteractionToolCall;
  const functionPayload =
    toolCall.function &&
    typeof toolCall.function === "object" &&
    !Array.isArray(toolCall.function)
      ? toolCall.function
      : null;
  const name = typeof toolCall.name === "string"
    ? toolCall.name
    : typeof functionPayload?.name === "string"
      ? functionPayload.name
      : "";
  if (!name) {
    return null;
  }

  const args = typeof toolCall.arguments !== "undefined"
    ? toolCall.arguments
    : typeof functionPayload?.arguments !== "undefined"
      ? functionPayload.arguments
      : toolCall.args;
  return { name, args };
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
  if (!rawQuestion) return null;
  const parsed = parseJsonRecord(rawQuestion);
  return parsed ? normalizePlanQuestionRequest(parsed) : null;
}

/** 解析计划预览结构 */
export function parsePlanPreview(
  content: string
): { title: string; planMarkdown: string } | null {
  const planMarkdown = extractTagContent(content, "proposed_plan");
  if (!planMarkdown) return null;
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
