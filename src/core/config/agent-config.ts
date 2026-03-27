import { AgentMode } from "../types.ts";
import type { AgentModeValue } from "../types.ts";

/** Agent 默认欢迎消息 */
export const AGENT_WELCOME_MESSAGE = `您好老板！\n\n我是一个会写代码的《牛码》；\n\n有什么可以为您效劳的？😊`;

/** Agent 默认工作模式 */
export const AGENT_DEFAULT_MODE: AgentModeValue = AgentMode.BUILD;

/** Agent 默认调试开关 */
export const AGENT_DEFAULT_DEBUG_MODE = false;

/** Agent 默认是否开启流式输出 */
export const AGENT_DEFAULT_STREAM_ENABLED = false;

/** 单轮对话最大工具循环次数，null 表示默认不限制 */
export const AGENT_MAX_ITERATIONS: number | null = null;

/** 任务耗时刷新间隔（毫秒） */
export const AGENT_DURATION_UPDATE_INTERVAL_MS = 100;

/** 模型请求最大尝试次数（包含首次请求） */
export const AGENT_API_MAX_ATTEMPTS = 3;

/** 模型请求初始重试等待时间（毫秒） */
export const AGENT_API_RETRY_BASE_DELAY_MS = 1200;

/** 模型请求最大重试等待时间（毫秒） */
export const AGENT_API_RETRY_MAX_DELAY_MS = 5000;

/** Agent 运行时状态文案 */
export const AGENT_STATUS_TEXT = {
  RECONNECTING_MCP: "正在重连 MCP 服务器...",
  THINKING: "玩命思考中...🐂🐎",
  WAITING_AI: "等待 AI 响应...",
  ABORTED: "\n⚠️ 已中断",
} as const;
