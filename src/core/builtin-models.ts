/**
 * 内置免费模型定义
 * 这些模型随 CLI 工具一起分发，用户安装后可直接使用
 * ID 使用 builtin_ 前缀，与用户自定义模型区分
 */
import type { ModelConfig } from "./types.ts";

/** 内置免费模型列表 */
export const BUILTIN_MODELS: ModelConfig[] = [
  {
    id: "kimi-free",
    name: "Kimi-k2",
    apiKey: "sk-9mJhOwVWzwUBEZvDsxFZf3PmzeZisCmVCkqSP71xiZuZrs0g",
    baseUrl: "https://elin521.cn:3002/v1",
    modelName: "moonshotai/Kimi-K2-Instruct-0905",
    builtin: true,
  },
    {
    id: "deepseek-free",
    name: "Deepseek-V3.2",
    apiKey: "sk-9mJhOwVWzwUBEZvDsxFZf3PmzeZisCmVCkqSP71xiZuZrs0g",
    baseUrl: "https://elin521.cn:3002/v1",
    modelName: "deepseek-ai/DeepSeek-V3.2",
    builtin: true,
  },
];
