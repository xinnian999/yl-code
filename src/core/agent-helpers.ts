import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// ============ 辅助类型 ============

export interface ToolCallChunk {
  name?: string;
  args?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ToolArgs {
  filePath?: string;
  directoryPath?: string;
  command?: string;
}

// ============ 纯辅助函数 ============

export function getToolNameFromChunk(toolCallChunks: ToolCallChunk[]): string | null {
  if (!toolCallChunks || toolCallChunks.length === 0) return null;
  return toolCallChunks[0].name || null;
}

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

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

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
    default:
      return `调用工具: ${toolName}`;
  }
}

export function loadSystemPrompt(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const template = readFileSync(join(__dirname, "system.md"), "utf-8");
  return template.replace("${process.cwd()}", process.cwd());
}
