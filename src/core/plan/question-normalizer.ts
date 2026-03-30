import type {
  PlanQuestionOption,
  PlanQuestionRequest,
} from "./interaction-types.ts";
import {
  PLAN_INTERACTION_NESTED_KEYS,
  PLAN_QUESTION_FIELD_KEYS,
} from "./interaction-types.ts";
import { parseJsonRecord } from "./interaction-json.ts";

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

  if (!raw || typeof raw !== "object") {
    return null;
  }

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
export function normalizePlanQuestionRequest(
  raw: Record<string, unknown>
): PlanQuestionRequest | null {
  for (const candidate of collectPayloadCandidates(raw)) {
    const title =
      getFirstStringField(candidate, PLAN_QUESTION_FIELD_KEYS.title)
      || "计划问题确认";
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
