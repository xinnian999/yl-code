import type { ModelConfig } from "../types.ts";

/** 内置免费模型的 API Key，从环境变量注入，不写入源码 */
const BUILTIN_API_KEY = process.env.BUILTIN_API_KEY ?? "";

/** 内置免费模型的代理地址，从环境变量注入 */
const BUILTIN_BASE_URL = process.env.BUILTIN_BASE_URL ?? "";

/** 内置模型列表 */
export const BUILTIN_MODELS: ModelConfig[] = [
  {
    id: "free-qwen3.5-plus",
    name: "qwen3.5-plus",
    apiKey: BUILTIN_API_KEY,
    baseUrl: BUILTIN_BASE_URL,
    modelName: "qwen3.5-plus",
    builtin: true,
  },
  {
    id: "free-qwen3-coder-next",
    name: "qwen3-coder-next",
    apiKey: BUILTIN_API_KEY,
    baseUrl: BUILTIN_BASE_URL,
    modelName: "qwen3-coder-next",
    builtin: true,
  },
];
