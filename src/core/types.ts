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

// ============ Todo 任务 ============

/** 任务状态 */
export const TodoStatus = {
  PENDING: "pending",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

/** 任务状态值类型 */
export type TodoStatusValue = (typeof TodoStatus)[keyof typeof TodoStatus];

/** 单个任务项 */
export interface TodoItem {
  /** 任务描述（祈使句，如"运行测试"） */
  content: string;
  /** 任务状态 */
  status: TodoStatusValue;
}

/** Todo 端口 - core 通过此接口管理任务列表 */
export interface TodoPort {
  /** 更新整个任务列表（全量替换） */
  updateTodos(todos: TodoItem[]): void;
  /** 获取当前任务列表 */
  getTodos(): TodoItem[];
  /** 清空任务列表 */
  clearTodos(): void;
}

// ============ 消息块 ============

/** 消息块基础字段 */
interface MessageBlockBase {
  /** 调试信息（JSON 字符串，仅 debug 模式下生成） */
  debug?: string;
}

/** 消息块类型 - AI 消息由多个块组成，按类型渲染 */
export type MessageBlock =
  | (MessageBlockBase & { type: "text"; content: string })
  | (MessageBlockBase & { type: "plan"; title: string; content: string })
  | (MessageBlockBase & { type: "tool"; content: string })
  | (MessageBlockBase & { type: "error"; content: string })
  | (MessageBlockBase & { type: "warning"; content: string })
  | (MessageBlockBase & { type: "todo"; todos: TodoItem[] });

// ============ Agent 模式 ============

/** Agent 工作模式 */
export const AgentMode = {
  ASK: "ask",
  BUILD: "build",
  PLAN: "plan",
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
  { value: "plan",  label: "Plan",  description: "计划模式" },
];

// ============ 模型配置 ============

export interface ModelConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
  /** 是否为内置模型（内置模型只读，用户不可编辑/删除） */
  builtin?: boolean;
}

// ============ 进程信息 ============

/** 后台进程状态 */
export type BackgroundProcessStatus = "running" | "exited";

/** 后台进程快照 */
export interface BackgroundProcessSnapshot {
  /** 进程 ID */
  pid: number;
  /** 原始命令 */
  command: string;
  /** 工作目录 */
  workingDirectory: string;
  /** 运行状态 */
  status: BackgroundProcessStatus;
  /** 退出码 */
  exitCode: number | null;
  /** 最近日志输出 */
  output: string;
  /** 启动时间戳 */
  startedAt: number;
}

/** 后台进程信息 */
export interface ProcessInfo {
  /** 进程 ID */
  pid: number;
  /** 原始命令 */
  command: string;
  /** 工作目录 */
  workingDirectory: string;
  /** 子进程实例 */
  process: ChildProcess;
  /** 运行状态 */
  status: BackgroundProcessStatus;
  /** 退出码 */
  exitCode: number | null;
  /** 最近日志输出 */
  output: string;
  /** 启动时间戳 */
  startedAt: number;
}

// ============ 端口接口 ============

/**
 * 消息端口 - core 通过此接口向前端推送输出
 */
export interface MessagePort {
  createAIMessage(): void;
  ai(content: string): void;
  plan(title: string, content: string): void;
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
  /** 注册后台进程 */
  registerBackgroundProcess(info: ProcessInfo): void;
  /** 获取后台进程快照列表 */
  getBackgroundProcesses(): BackgroundProcessSnapshot[];
}

// ============ 上下文管理 ============

/** 上下文使用量信息 */
export interface ContextUsage {
  /** 当前预估 token 数 */
  currentTokens: number;
  /** 最大 token 数 */
  maxTokens: number;
  /** 使用百分比（0-100） */
  percentage: number;
}

/** 上下文端口 - core 通过此接口管理上下文状态 */
export interface ContextPort {
  /** 获取当前上下文使用量 */
  getUsage(): ContextUsage;
  /** 更新当前 token 数 */
  updateUsage(currentTokens: number): void;
}
