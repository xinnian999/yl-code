/** 模型请求重试策略 */
export interface ModelRetryPolicy {
  /** 最大尝试次数（包含首次请求） */
  maxAttempts: number;
  /** 初始退避时间（毫秒） */
  baseDelayMs: number;
  /** 最大退避时间（毫秒） */
  maxDelayMs: number;
}

/** 模型请求重试决策 */
export interface ModelRetryDecision {
  /** 是否应继续重试 */
  shouldRetry: boolean;
  /** 下次重试前等待时间 */
  delayMs: number;
  /** 当前错误的简要原因 */
  reason: string;
}

/** 可自动重试的 HTTP 状态码 */
const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

/** 可自动重试的错误关键词 */
const RETRYABLE_ERROR_PATTERNS = [
  /system memory overloaded/i,
  /overloaded/i,
  /rate limit/i,
  /temporarily unavailable/i,
  /timeout/i,
  /timed out/i,
  /fetch failed/i,
  /socket hang up/i,
  /connection.*reset/i,
  /connection.*closed/i,
  /econnreset/i,
  /etimedout/i,
  /eai_again/i,
  /network error/i,
];

/** 从错误对象中提取 HTTP 状态码 */
function extractStatusCode(error: unknown): number | null {
  const err = error as Record<string, any> | undefined;
  const candidates = [
    err?.status,
    err?.statusCode,
    err?.response?.status,
    err?.error?.status,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number") {
      return candidate;
    }
  }

  return null;
}

/** 从错误对象中提取简短错误文本 */
function extractErrorMessage(error: unknown): string {
  const err = error as Record<string, any> | undefined;
  const message =
    err?.message
    || err?.error?.message
    || err?.response?.data?.error?.message
    || err?.response?.data?.message;

  if (typeof message === "string" && message.trim()) {
    return message.trim();
  }

  return String(error).trim();
}

/** 判断是否为用户主动中断 */
export function isAbortLikeError(error: unknown): boolean {
  const err = error as Record<string, any> | undefined;
  const name = typeof err?.name === "string" ? err.name : "";
  const message = extractErrorMessage(error).toLowerCase();

  return name === "AbortError"
    || message.includes("aborted")
    || message.includes("signal is aborted");
}

/** 判断本次流式请求是否已经产生可见正文 */
function hasVisibleOutput(error: unknown): boolean {
  const err = error as Record<string, any> | undefined;
  return err?.hasVisibleOutput === true;
}

/** 为提示文案生成简短错误原因 */
function buildRetryReason(error: unknown, statusCode: number | null): string {
  const message = extractErrorMessage(error);
  if (statusCode !== null) {
    return `${statusCode} ${message}`.trim();
  }
  return message || "未知错误";
}

/** 计算指数退避时间 */
function calculateRetryDelay(
  attempt: number,
  policy: ModelRetryPolicy
): number {
  const exponentialDelay = policy.baseDelayMs * (2 ** Math.max(0, attempt - 1));
  return Math.min(exponentialDelay, policy.maxDelayMs);
}

/** 判断当前错误是否值得自动重试 */
export function getModelRetryDecision(
  error: unknown,
  attempt: number,
  policy: ModelRetryPolicy
): ModelRetryDecision {
  if (attempt >= policy.maxAttempts || isAbortLikeError(error) || hasVisibleOutput(error)) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: buildRetryReason(error, extractStatusCode(error)),
    };
  }

  const statusCode = extractStatusCode(error);
  const message = extractErrorMessage(error);
  const isRetryable =
    (statusCode !== null && RETRYABLE_STATUS_CODES.has(statusCode))
    || RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(message));

  if (!isRetryable) {
    return {
      shouldRetry: false,
      delayMs: 0,
      reason: buildRetryReason(error, statusCode),
    };
  }

  return {
    shouldRetry: true,
    delayMs: calculateRetryDelay(attempt, policy),
    reason: buildRetryReason(error, statusCode),
  };
}

/** 等待一段时间后继续，期间支持中断 */
export async function waitForRetryDelay(
  delayMs: number,
  signal: AbortSignal
): Promise<void> {
  if (delayMs <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);

    /** 中断等待并抛出 AbortError */
    function handleAbort(): void {
      clearTimeout(timer);
      signal.removeEventListener("abort", handleAbort);
      const abortError = new Error("请求已中断");
      abortError.name = "AbortError";
      reject(abortError);
    }

    if (signal.aborted) {
      handleAbort();
      return;
    }

    signal.addEventListener("abort", handleAbort, { once: true });
  });
}
