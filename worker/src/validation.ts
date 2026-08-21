import {
  ALLOWED_MODELS,
  MAX_OUTPUT_TOKENS,
  MAX_REQUEST_BYTES,
} from "./constants.ts";

/** 校验成功后使用的聊天请求体 */
export interface ChatCompletionPayload extends Record<string, unknown> {
  /** 上游模型名称 */
  model: string;
}

/** 请求校验结果 */
export type ValidationResult =
  | { ok: true; payload: ChatCompletionPayload }
  | { ok: false; code: string; message: string; status: number };

/** 判断未知值是否为普通对象 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** 校验请求体长度，避免读取无界 JSON */
export function validateContentLength(request: Request): ValidationResult | null {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) {
    return {
      ok: false,
      status: 411,
      code: "length_required",
      message: "请求必须包含 Content-Length。",
    };
  }

  const length = Number(rawLength);
  if (!Number.isInteger(length) || length <= 0 || length > MAX_REQUEST_BYTES) {
    return {
      ok: false,
      status: 413,
      code: "request_too_large",
      message: "请求体大小无效或超过 2 MiB。",
    };
  }

  return null;
}

/** 校验模型白名单和输出 Token 上限 */
export function validatePayload(value: unknown): ValidationResult {
  if (!isRecord(value) || typeof value.model !== "string") {
    return {
      ok: false,
      status: 400,
      code: "invalid_request_body",
      message: "请求体必须包含有效的 model 字段。",
    };
  }

  if (!ALLOWED_MODELS.has(value.model)) {
    return {
      ok: false,
      status: 403,
      code: "model_not_allowed",
      message: "该模型不在免费模型白名单中。",
    };
  }

  const tokenFields = [value.max_tokens, value.max_completion_tokens];
  const exceedsLimit = tokenFields.some(
    (tokens) => typeof tokens === "number" && tokens > MAX_OUTPUT_TOKENS,
  );
  if (exceedsLimit) {
    return {
      ok: false,
      status: 400,
      code: "max_tokens_exceeded",
      message: `单次请求最多允许 ${MAX_OUTPUT_TOKENS} 个输出 Token。`,
    };
  }

  return { ok: true, payload: { ...value, model: value.model } };
}
