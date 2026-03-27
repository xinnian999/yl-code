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
import { platform } from "os";
import { toDisplayCommand, toDisplayPath } from "./path-display.ts";

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
  file?: string;
  path?: string;
  directory?: string;
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
    const fileMatch = argsStr.match(/"file"\s*:\s*"([^"]+)"/);
    if (fileMatch) return fileMatch[1];
    const pathMatch = argsStr.match(/"path"\s*:\s*"([^"]+)"/);
    if (pathMatch) return pathMatch[1];
    const dirPathMatch = argsStr.match(/"directoryPath"\s*:\s*"([^"]+)"/);
    if (dirPathMatch) return dirPathMatch[1];
    const dirMatch = argsStr.match(/"directory"\s*:\s*"([^"]+)"/);
    if (dirMatch) return dirMatch[1];
    const commandMatch = argsStr.match(/"command"\s*:\s*"([^"]+)"/);
    if (commandMatch) return commandMatch[1];
  } catch {
    // 忽略解析错误
  }
  return null;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTotalDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const totalSeconds = Math.round(ms / 1000);
  if (totalSeconds < 60) return `${totalSeconds}秒`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (seconds === 0) return `${minutes}分`;
  return `${minutes}分${seconds}秒`;
}

/** 根据工具名称和参数生成中文描述 */
export function getToolDescription(toolName: string, args: ToolArgs): string {
  const rawFileTarget = args.filePath || args.file || args.path;
  const rawDirTarget = args.directoryPath || args.directory || args.path;
  const fileTarget = rawFileTarget ? toDisplayPath(rawFileTarget) : "未提供路径";
  const dirTarget = rawDirTarget ? toDisplayPath(rawDirTarget) : "未提供目录";
  const commandTarget = args.command ? toDisplayCommand(args.command) : "未提供命令";

  switch (toolName) {
    case "read_file":
      return `阅读代码: ${fileTarget}`;
    case "write_file":
      return `写入代码: ${fileTarget}`;
    case "write_file_patch":
      return `修改代码: ${fileTarget}`;
    case "execute_command":
      return `执行命令: ${commandTarget}`;
    case "read_background_logs":
      return "查看后台日志";
    case "list_directory":
      return `查看目录: ${dirTarget}`;
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
        "你只能使用 `read_file` 和 `list_directory` 工具来阅读代码、回答问题。",
        "禁止调用 `write_file`、`write_file_patch`、`execute_command`、`todo_write` 和所有 MCP 工具。",
        "如果用户要求修改代码、执行命令或落地实现，请明确告知用户切换到 Build 模式。",
      ].join("\n");
    case AgentMode.BUILD:
      return "当前是 **构建模式（Build）**，你可以使用所有工具来完成编码任务。";
    case AgentMode.PLAN:
      return [
        "当前是 **计划模式（Plan）**。",
        "你只能使用 `read_file` 和 `list_directory` 工具进行只读探索，禁止调用 `write_file`、`write_file_patch`、`execute_command`、`todo_write` 和所有 MCP 工具。",
        "你的目标是先通过阅读代码消除可发现的不确定性，再判断是否还需要向用户提问。",
        "如果信息不足，请继续读代码；只有在无法通过代码确定、且会影响方案的关键问题上，才向用户提问。",
        "当你需要向用户提问时，不要输出普通问题文本，必须只输出一个 `<plan_question>` 块，块内是 JSON 对象，格式为 {\"title\":\"...\",\"question\":\"...\",\"options\":[{\"label\":\"...\",\"description\":\"...\"}]}。",
        "`plan_question` 和 `<proposed_plan>` 都是输出标签，不是工具名，绝对不要把它们作为工具调用。",
        "问题选项只需要提供固定候选项，系统会自动追加最后一个“自定义输入”选项，因此不要自己重复输出自定义选项。",
        "禁止直接落地执行、修改文件、运行命令或给出已经开始实现的结果。",
        "只有当信息齐备时，最终回复必须只输出一个 `<proposed_plan>` Markdown 块，不要在块前后添加额外说明。",
        "该块内必须包含：标题、概要、关键改动或实现改动、测试计划、前提假设。",
        "计划里的章节标题必须使用中文，不要出现 Summary、Key Changes、Implementation Changes、Test Plan、Assumptions 等英文标题。",
      ].join("\n");
    default:
      return "";
  }
}

/** 根据模板和模式构建完整系统提示词 */
export function buildSystemPrompt(template: string, mode: AgentModeValue): string {
  return template
    .replace("{workingDirectory}", process.cwd())
    .replace("{workingMode}", mode)
    .replace("{modeInstructions}", getModeInstructions(mode))
    .replace("{os}", platform())
    .replace("{currentTime}", new Date().toLocaleString());
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
