/** 代理允许接收的最大 JSON 请求体，单位为字节 */
export const MAX_REQUEST_BYTES = 2 * 1024 * 1024;

/** 单次模型请求允许的最大输出 Token 数 */
export const MAX_OUTPUT_TOKENS = 32_768;

/** 代理允许调用的模型白名单 */
export const ALLOWED_MODELS = new Set([
  "qwen3.5-plus",
  "qwen3-coder-next",
]);

/** 代理唯一允许的模型接口路径 */
export const CHAT_COMPLETIONS_PATH = "/v1/chat/completions";

/** 根域名下分配给模型代理的路径前缀 */
export const API_ROUTE_PREFIX = "/api/yl-code";

/** 将根域路由和独立子域名统一为相同的内部路径 */
export function normalizeProxyPath(pathname: string): string {
  if (!pathname.startsWith(API_ROUTE_PREFIX)) return pathname;
  return pathname.slice(API_ROUTE_PREFIX.length) || "/";
}
