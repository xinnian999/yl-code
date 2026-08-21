/** OpenAI 兼容错误体的可选配置 */
export interface ErrorResponseOptions {
  /** HTTP 状态码 */
  status: number;
  /** 稳定的机器错误码 */
  code: string;
  /** 面向调用方的错误信息 */
  message: string;
  /** 附加响应头 */
  headers?: HeadersInit;
}

/** 创建 OpenAI 兼容的 JSON 错误响应 */
export function createErrorResponse(options: ErrorResponseOptions): Response {
  const headers = new Headers(options.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");

  return Response.json(
    {
      error: {
        message: options.message,
        type: "invalid_request_error",
        code: options.code,
      },
    },
    { status: options.status, headers },
  );
}
