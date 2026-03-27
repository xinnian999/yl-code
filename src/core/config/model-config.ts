import type { ModelConfig } from "../types.ts";

/** 内置模型列表 */
export const BUILTIN_MODELS: ModelConfig[] = [
  {
    id: "free-qwen3-coder-next",
    name: "qwen3-coder-next",
    apiKey: "sk-j1mm9Cfd0oB6WI6qSljxdavlxH21nuHwZrw4VSZe6ibZyD5U",
    baseUrl: "https://code0.ai/v1",
    modelName: "qwen3-coder-next",
    builtin: true,
  },
  {
    id: "free-qwen3.5-plus",
    name: "qwen3.5-plus",
    apiKey: "sk-j1mm9Cfd0oB6WI6qSljxdavlxH21nuHwZrw4VSZe6ibZyD5U",
    baseUrl: "https://code0.ai/v1",
    modelName: "qwen3.5-plus",
    builtin: true,
  },
];
