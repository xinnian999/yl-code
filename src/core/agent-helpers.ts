import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { AgentMode, ThinkingStatus } from "./types.ts";
import type { AgentModeValue } from "./types.ts";
import type { BaseMessage } from "@langchain/core/messages";
import type { MessageBus } from "./message-bus.ts";
import type { ConfirmBus } from "./confirm-bus.ts";
import type { TodoBus } from "./todo-bus.ts";
import type { ContextBus } from "./context/context-bus.ts";
import type { ConfigManager } from "./config.ts";
import type { ModeTool } from "./tools.ts";

// ============ Agent 上下文接口 ============

/** Agent 内部状态的访问接口，供拆分模块使用 */
export interface AgentContext {
  /** 消息总线 */
  readonly messageBus: MessageBus;
  /** 确认总线 */
  readonly confirmBus: ConfirmBus;
  /** 任务总线 */
  readonly todoBus: TodoBus;
  /** 上下文总线 */
  readonly contextBus: ContextBus;
  /** 配置管理器 */
  readonly config: ConfigManager;
  /** 对话消息历史 */
  chatMessages: BaseMessage[];
  /** 调试模式开关 */
  debugMode: boolean;
  /** 当前工作模式 */
  mode: AgentModeValue;
  /** 带模式标签的工具列表 */
  tools: ModeTool[];
}

// ============ 辅助类型 ============

/** 流式工具调用的分片数据 */
export interface ToolCallChunk {
  name?: string;
  args?: string;
}

/** 完整的工具调用信息 */
export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

/** 工具参数，用于生成描述文本 */
export interface ToolArgs {
  filePath?: string;
  directoryPath?: string;
  command?: string;
}

// ============ 纯辅助函数 ============

/** 从流式分片中提取工具名称 */
export function getToolNameFromChunk(toolCallChunks: ToolCallChunk[]): string | null {
  if (!toolCallChunks || toolCallChunks.length === 0) return null;
  return toolCallChunks[0].name || null;
}

/** 从流式分片中预览工具参数（文件路径或命令） */
export function getToolArgsPreview(toolCallChunks: ToolCallChunk[]): string | null {
  if (!toolCallChunks || toolCallChunks.length === 0) return null;
  const argsStr = toolCallChunks[0].args;
  if (!argsStr) return null;

  try {
    const filePathMatch = argsStr.match(/"filePath"\s*:\s*"([^"]+)"/);
    if (filePathMatch) return filePathMatch[1];
    const dirPathMatch = argsStr.match(/"directoryPath"\s*:\s*"([^"]+)"/);
    if (dirPathMatch) return dirPathMatch[1];
    const commandMatch = argsStr.match(/"command"\s*:\s*"([^"]+)"/);
    if (commandMatch) return commandMatch[1];
  } catch {
    // 忽略解析错误
  }
  return null;
}

/** 将毫秒数格式化为可读时间 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 根据工具名称和参数生成中文描述 */
export function getToolDescription(toolName: string, args: ToolArgs): string {
  switch (toolName) {
    case "read_file":
      return `阅读代码: ${args.filePath}`;
    case "write_file":
      return `写入代码: ${args.filePath}`;
    case "execute_command":
      return `执行命令: ${args.command}`;
    case "list_directory":
      return `查看目录: ${args.directoryPath}`;
    case "todo_write":
      return "更新任务列表";
    default:
      return `调用工具: ${toolName}`;
  }
}

/** 加载 system.md 原始模板 */
export function loadSystemTemplate(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  return readFileSync(join(__dirname, "system.md"), "utf-8");
}

/** 根据模式生成模式说明文本 */
export function getModeInstructions(mode: AgentModeValue): string {
  switch (mode) {
    case AgentMode.ASK:
      return [
        "当前是 **问答模式（Ask）**。",
        "你只能使用 `read_file`、`list_directory` 和 `todo_write` 工具来阅读代码、回答问题、跟踪任务。",
        "**严禁调用 `write_file` 或 `execute_command`**，即使用户要求也不行，请告知用户切换到 Build 模式。",
      ].join("\n");
    case AgentMode.BUILD:
      return "当前是 **构建模式（Build）**，你可以使用所有工具来完成编码任务。";
    default:
      return "";
  }
}

/** 根据模板和模式构建完整系统提示词 */
export function buildSystemPrompt(template: string, mode: AgentModeValue): string {
  return template
    .replace("${process.cwd()}", process.cwd())
    .replace("${mode_instructions}", getModeInstructions(mode));
}

/** 根据思考状态获取默认显示文本 */
export function getStatusText(status: string, detail: string): string {
  if (detail) return detail;

  switch (status) {
    case ThinkingStatus.THINKING:
      return "玩命思考中...";
    case ThinkingStatus.TOOL_CALLING:
      return "正在执行工具...";
    case ThinkingStatus.WAITING:
      return "等待响应中...";
    default:
      return "";
  }
}
