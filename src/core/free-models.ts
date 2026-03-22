/**
 * 内置免费模型定义
 * 这些模型随 CLI 工具一起分发，用户安装后可直接使用
 * ID 使用 builtin_ 前缀，与用户自定义模型区分
 */
import type { ModelConfig } from "./types.ts";

/** 内置免费模型列表 */
export const FREE_MODELS: ModelConfig[] = [
  {
    id: "qwen3-free",
    name: "qwen3-coder-next",
    apiKey: "sk-j1mm9Cfd0oB6WI6qSljxdavlxH21nuHwZrw4VSZe6ibZyD5U",
    baseUrl: "https://code0.ai/v1",
    modelName: "qwen3-coder-next",
    free: true,
  },
];
