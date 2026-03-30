import type {
  PlanInteractionToolCall,
  PlanPreviewData,
  RawPlanInteractionToolCall,
} from "./interaction-types.ts";
import {
  PLAN_HEADING_REPLACEMENTS,
} from "./interaction-types.ts";
import { parseJsonRecord } from "./interaction-json.ts";

/** 从 Markdown 中推断计划标题 */
function inferPlanTitle(planMarkdown: string): string {
  const firstLine = planMarkdown
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) {
    return "计划预览";
  }
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
export function normalizePlanPreviewData(raw: unknown): PlanPreviewData | null {
  const parsedStringPayload =
    typeof raw === "string" ? parseJsonRecord(raw) : null;
  const payload =
    parsedStringPayload ||
    (raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : null);

  let rawPlanMarkdown = "";
  if (typeof raw === "string" && !parsedStringPayload) {
    rawPlanMarkdown = raw;
  } else if (typeof payload?.planMarkdown === "string") {
    rawPlanMarkdown = payload.planMarkdown;
  } else if (typeof payload?.plan === "string") {
    rawPlanMarkdown = payload.plan;
  } else if (typeof payload?.content === "string") {
    rawPlanMarkdown = payload.content;
  } else if (typeof payload?.markdown === "string") {
    rawPlanMarkdown = payload.markdown;
  }

  const planMarkdown = normalizePlanMarkdown(rawPlanMarkdown.trim());
  if (!planMarkdown) {
    return null;
  }

  const title =
    typeof payload?.title === "string" && payload.title.trim()
      ? payload.title.trim()
      : inferPlanTitle(planMarkdown);

  return { title, planMarkdown };
}

/** 将原始工具调用结构归一化为计划交互可识别格式 */
export function normalizeRawToolCall(
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
  const name =
    typeof toolCall.name === "string"
      ? toolCall.name
      : typeof functionPayload?.name === "string"
        ? functionPayload.name
        : "";
  if (!name) {
    return null;
  }

  const args =
    typeof toolCall.arguments !== "undefined"
      ? toolCall.arguments
      : typeof functionPayload?.arguments !== "undefined"
        ? functionPayload.arguments
        : toolCall.args;
  return { name, args };
}
