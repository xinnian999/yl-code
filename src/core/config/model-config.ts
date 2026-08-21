import type { ModelConfig } from "../types.ts";

/** 内置免费模型使用的公开客户端标识，不具备上游鉴权能力 */
const BUILTIN_CLIENT_KEY = "yl-code-client";

/** 内置免费模型的 Cloudflare 代理地址 */
const BUILTIN_BASE_URL = "https://elin521.cn/api/yl-code/v1";

/** 内置模型列表 */
export const BUILTIN_MODELS: ModelConfig[] = [
  {
    id: "free-qwen3.5-plus",
    name: "qwen3.5-plus",
    apiKey: BUILTIN_CLIENT_KEY,
    baseUrl: BUILTIN_BASE_URL,
    modelName: "qwen3.5-plus",
    builtin: true,
  },
  {
    id: "free-qwen3-coder-next",
    name: "qwen3-coder-next",
    apiKey: BUILTIN_CLIENT_KEY,
    baseUrl: BUILTIN_BASE_URL,
    modelName: "qwen3-coder-next",
    builtin: true,
  },
];
