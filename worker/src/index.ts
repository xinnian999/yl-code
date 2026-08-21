import { CHAT_COMPLETIONS_PATH, normalizeProxyPath } from "./constants.ts";
import { createErrorResponse } from "./responses.ts";
import { validateContentLength, validatePayload } from "./validation.ts";

/** 构造上游聊天补全接口地址 */
function createUpstreamUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

/** 读取请求 JSON，并将解析失败转换为稳定错误 */
async function readPayload(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

/** 将上游响应以流的形式原样返回，同时阻止缓存 */
function createProxyResponse(upstream: Response): Response {
  const headers = new Headers(upstream.headers);
  headers.set("cache-control", "no-store");
  headers.delete("set-cookie");
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

/** 处理聊天补全代理请求 */
async function handleChatCompletion(request: Request, env: Env): Promise<Response> {
  const lengthError = validateContentLength(request);
  if (lengthError && !lengthError.ok) return createErrorResponse(lengthError);

  const clientKey = request.headers.get("cf-connecting-ip") ?? "unknown-client";
  const rateLimit = await env.RATE_LIMITER.limit({ key: clientKey });
  if (!rateLimit.success) {
    return createErrorResponse({
      status: 429,
      code: "rate_limit_exceeded",
      message: "请求过于频繁，请稍后再试。",
      headers: { "retry-after": "60" },
    });
  }

  const validation = validatePayload(await readPayload(request));
  if (!validation.ok) return createErrorResponse(validation);

  const upstream = await fetch(createUpstreamUrl(env.UPSTREAM_BASE_URL), {
    method: "POST",
    headers: {
      accept: request.headers.get("accept") ?? "application/json",
      authorization: `Bearer ${env.BUILTIN_API_KEY}`,
      "content-type": "application/json",
      "user-agent": "yl-code-model-proxy/1.0",
    },
    body: JSON.stringify(validation.payload),
    redirect: "manual",
    signal: AbortSignal.any([
      request.signal,
      AbortSignal.timeout(280_000),
    ]),
  });
  return createProxyResponse(upstream);
}

/** Cloudflare Worker HTTP 入口 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const pathname = normalizeProxyPath(url.pathname);
    if (request.method === "GET" && pathname === "/health") {
      return Response.json({ ok: true, service: "yl-code-model-proxy" });
    }

    if (request.method !== "POST" || pathname !== CHAT_COMPLETIONS_PATH) {
      return createErrorResponse({
        status: 404,
        code: "route_not_found",
        message: "接口不存在。",
      });
    }

    if (!request.headers.get("content-type")?.includes("application/json")) {
      return createErrorResponse({
        status: 415,
        code: "unsupported_media_type",
        message: "请求必须使用 application/json。",
      });
    }

    try {
      return await handleChatCompletion(request, env);
    } catch (error) {
      console.error(JSON.stringify({
        message: "upstream request failed",
        error: error instanceof Error ? error.message : String(error),
        requestId: request.headers.get("cf-ray"),
      }));
      return createErrorResponse({
        status: 502,
        code: "upstream_unavailable",
        message: "免费模型服务暂时不可用，请稍后再试。",
      });
    }
  },
} satisfies ExportedHandler<Env>;
