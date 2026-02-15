import type { ChildProcess } from "node:child_process";

// ============ 共享常量 ============

export const MessageType = {
  AI: "ai",
  USER: "user",
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

export const ThinkingStatus = {
  IDLE: "idle",
  THINKING: "thinking",
  TOOL_CALLING: "tool_calling",
  WAITING: "waiting",
} as const;

export type ThinkingStatusValue =
  (typeof ThinkingStatus)[keyof typeof ThinkingStatus];

export interface ThinkingState {
  status: ThinkingStatusValue;
  detail: string;
}

export type ConfirmResult = "accept" | "accept_all" | "reject";

// ============ Agent 模式 ============

/** Agent 工作模式 */
export const AgentMode = {
  ASK: "ask",
  BUILD: "build",
} as const;

/** Agent 模式值类型 */
export type AgentModeValue = (typeof AgentMode)[keyof typeof AgentMode];

/** 模式配置信息（用于 UI 展示和扩展） */
export interface AgentModeConfig {
  value: AgentModeValue;
  label: string;
  description: string;
}

/** 所有可用模式列表 */
export const AGENT_MODES: AgentModeConfig[] = [
  { value: "ask",   label: "Ask",   description: "问答模式" },
  { value: "build", label: "Build", description: "构建模式" },
];

// ============ 模型配置 ============

export interface ModelConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

// ============ 进程信息 ============

export interface ProcessInfo {
  pid: number;
  command: string;
  workingDirectory: string;
  process: ChildProcess;
}

// ============ 端口接口 ============

/**
 * 消息端口 - core 通过此接口向前端推送输出
 */
export interface MessagePort {
  createAIMessage(): void;
  ai(content: string): void;
  tool(content: string): void;
  error(content: string): void;
  setThinkingStatus(status: ThinkingStatusValue, detail?: string): void;
}

/**
 * 确认端口 - core 通过此接口请求用户确认文件写入和命令执行
 */
export interface ConfirmPort {
  requestConfirm(
    filePath: string,
    originalContent: string,
    newContent: string
  ): Promise<ConfirmResult>;

  requestCommandConfirm(
    command: string,
    workingDirectory?: string,
    background?: boolean
  ): Promise<ConfirmResult>;

  resetSkipConfirm(): void;

  readonly totalWaitTime: number;
}

/**
 * 配置端口 - core 通过此接口读取模型配置
 */
export interface ConfigPort {
  getCurrentModel(): ModelConfig;
  onModelChange(callback: () => void): () => void;
}

/**
 * 进程端口 - core 通过此接口注册后台进程
 */
export interface ProcessPort {
  registerBackgroundProcess(info: ProcessInfo): void;
}
