import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import fs from "node:fs/promises";
import path from "node:path";
import { applyPatch, type StructuredPatch } from "diff";
import { z } from "zod";
import { AgentMode } from "./types.ts";
import type { ConfirmPort, ProcessPort, TodoPort, TodoItem, AgentModeValue } from "./types.ts";
import {
  executeShellCommand,
  formatBackgroundProcessLogs,
} from "./command-executor.ts";
import {
  sanitizeDisplayText,
  toDisplayCommand,
  toDisplayPath,
} from "./path-display.ts";

// ============ 类型定义 ============

/** 带模式标签的工具 */
export interface ModeTool {
  tool: StructuredToolInterface;
  modes: AgentModeValue[];
}

// ============ 工具筛选 ============

/** 按模式筛选可用工具 */
export function getToolsForMode(tools: ModeTool[], mode: AgentModeValue): StructuredToolInterface[] {
  return tools.filter((t) => t.modes.includes(mode)).map((t) => t.tool);
}

function buildTodoSummary(todos: Array<{ status: string }>): string {
  const total = todos.length;
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const pending = todos.filter((t) => t.status === "pending").length;
  return `共 ${total} 项: ${completed} 完成, ${inProgress} 进行中, ${pending} 待处理`;
}

function buildStructuredPatch(patchText: string): StructuredPatch | null {
  const normalized = patchText.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const hunks: any[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("@@")) {
      const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      const oldStart = match ? parseInt(match[1], 10) : 1;
      const newStart = match ? parseInt(match[3], 10) : 1;
      const hunkLines: string[] = [];
      const delimiters: string[] = [];

      i += 1;
      while (i < lines.length && !lines[i].startsWith("@@")) {
        const current = lines[i];
        if (current === "" && i === lines.length - 1) {
          i += 1;
          break;
        }
        if (/^[ +\-\\]/.test(current)) {
          hunkLines.push(current);
          delimiters.push("\n");
        }
        i += 1;
      }

      const oldLines = hunkLines.filter((l) => l[0] === " " || l[0] === "-").length;
      const newLines = hunkLines.filter((l) => l[0] === " " || l[0] === "+").length;

      const hunk: any = {
        oldStart,
        oldLines,
        newStart,
        newLines,
        lines: hunkLines,
        linedelimiters: delimiters,
      };
      hunks.push(hunk);
      continue;
    }
    i += 1;
  }

  if (hunks.length === 0) return null;

  const patch: StructuredPatch = {
    oldFileName: "",
    newFileName: "",
    oldHeader: "",
    newHeader: "",
    hunks,
  } as unknown as StructuredPatch;

  return patch;
}

function applyPatchWithFallback(originalContent: string, patchText: string): string | false {
  try {
    const directResult = applyPatch(originalContent, patchText);
    if (directResult !== false) {
      return directResult;
    }
  } catch {
  }

  const structured = buildStructuredPatch(patchText);
  if (!structured) return false;

  try {
    const structuredResult = applyPatch(originalContent, structured);
    return structuredResult;
  } catch {
    return false;
  }
}

/** 选择需要查看的后台进程 */
function pickBackgroundProcess(
  processes: ReturnType<ProcessPort["getBackgroundProcesses"]>,
  pid?: number,
  command?: string
) {
  if (typeof pid === "number") {
    return processes.find((processInfo) => processInfo.pid === pid) || null;
  }

  if (command && command.trim()) {
    const normalized = command.trim().toLowerCase();
    const matched = processes.filter((processInfo) =>
      processInfo.command.toLowerCase().includes(normalized)
    );
    return matched.at(-1) || null;
  }

  const runningProcess = [...processes]
    .reverse()
    .find((processInfo) => processInfo.status === "running");
  return runningProcess || processes.at(-1) || null;
}

/**
 * 创建工具集，通过端口注入确认和进程管理能力
 * 每个工具绑定支持的模式标签，用于按模式筛选
 */
export function createTools(confirm: ConfirmPort, processPort: ProcessPort, todoPort: TodoPort): ModeTool[] {
  const readFileTool = tool(
    async ({ filePath }: { filePath: string }): Promise<string> => {
      const resolvedPath = path.resolve(filePath);
      const displayPath = toDisplayPath(resolvedPath);
      try {
        const content = await fs.readFile(resolvedPath, "utf-8");
        return `文件内容:\n${content}`;
      } catch (error) {
        const err = error as Error;
        return `读取文件失败: ${sanitizeDisplayText(err.message, resolvedPath) || displayPath}`;
      }
    },
    {
      name: "read_file",
      description: "读取指定路径的文件内容",
      schema: z.object({
        filePath: z.string().describe("文件路径"),
      }),
    }
  );

  const writeFileTool = tool(
    async ({ filePath, content }: { filePath: string; content: string }): Promise<string> => {
      const resolvedPath = path.resolve(filePath);
      const displayPath = toDisplayPath(resolvedPath);
      try {
        let originalContent = "";
        try {
          originalContent = await fs.readFile(resolvedPath, "utf-8");
        } catch {
          // 文件不存在，视为新文件
        }

        if (originalContent === content) {
          return `文件内容未变化，无需写入: ${displayPath}`;
        }

        const result = await confirm.requestConfirm(resolvedPath, originalContent, content);

        if (result === "reject") {
          return `用户拒绝了对 ${displayPath} 的修改，请根据情况调整方案或询问用户意见`;
        }

        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolvedPath, content, "utf-8");

        const isNewFile = originalContent === "";
        return isNewFile
          ? `文件创建成功: ${displayPath}`
          : `文件写入成功: ${displayPath}`;
      } catch (error) {
        const err = error as Error;
        return `写入文件失败: ${sanitizeDisplayText(err.message, resolvedPath) || displayPath}`;
      }
    },
    {
      name: "write_file",
      description: "向指定路径写入文件内容，自动创建目录。写入前会请求用户确认。",
      schema: z.object({
        filePath: z.string().describe("文件路径"),
        content: z.string().describe("要写入的文件内容"),
      }),
    }
  );

  const writeFilePatchTool = tool(
    async ({ filePath, patch }: { filePath: string; patch: string }): Promise<string> => {
      const resolvedPath = path.resolve(filePath);
      const displayPath = toDisplayPath(resolvedPath);
      try {
        let originalContent = "";
        try {
          originalContent = await fs.readFile(resolvedPath, "utf-8");
        } catch {
          // 文件不存在，视为新文件
        }

        const patchedContent = applyPatchWithFallback(originalContent, patch);
        if (patchedContent === false) {
          return `补丁应用失败: ${displayPath}`;
        }

        if (patchedContent === originalContent) {
          return `文件内容未变化，无需写入: ${displayPath}`;
        }

        const result = await confirm.requestConfirm(resolvedPath, originalContent, patchedContent);

        if (result === "reject") {
          return `用户拒绝了对 ${displayPath} 的修改，请根据情况调整方案或询问用户意见`;
        }

        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolvedPath, patchedContent, "utf-8");

        const isNewFile = originalContent === "";
        return isNewFile
          ? `文件创建成功: ${displayPath}`
          : `文件写入成功: ${displayPath}`;
      } catch (error) {
        const err = error as Error;
        return `写入文件失败: ${sanitizeDisplayText(err.message, resolvedPath) || displayPath}`;
      }
    },
    {
      name: "write_file_patch",
      description: "使用统一 diff 补丁写入文件内容，避免传输完整文件。补丁需包含 @@ 片段和以空格/+/− 开头的行，无需精确计算统计数字。写入前会请求用户确认。",
      schema: z.object({
        filePath: z.string().describe("文件路径"),
        patch: z.string().describe("统一 diff 格式的补丁内容"),
      }),
    }
  );

  const executeCommandTool = tool(
    async ({
      command,
      workingDirectory,
      background = false,
      timeoutMs,
    }: {
      command: string;
      workingDirectory?: string;
      background?: boolean;
      timeoutMs?: number;
    }): Promise<string> => {
      const cwd = workingDirectory || process.cwd();

      const result = await confirm.requestCommandConfirm(command, workingDirectory, background);

      if (result === "reject") {
        return `用户拒绝执行命令: ${toDisplayCommand(command)}，请根据情况调整方案或询问用户意见`;
      }

      return executeShellCommand({
        command,
        workingDirectory: cwd,
        background,
        timeoutMs,
        processPort,
      });
    },
    {
      name: "execute_command",
      description: "执行系统命令，支持指定工作目录，实时显示输出。执行前会请求用户确认。",
      schema: z.object({
        command: z.string().describe("要执行的命令"),
        workingDirectory: z.string().optional().describe("工作目录（推荐指定）"),
        background: z.boolean().optional().describe("是否在后台运行"),
        timeoutMs: z.number().int().positive().optional().describe("前台命令超时时间（毫秒）"),
      }),
    }
  );

  const readBackgroundLogsTool = tool(
    async ({
      pid,
      command,
      maxChars = 4000,
    }: {
      pid?: number;
      command?: string;
      maxChars?: number;
    }): Promise<string> => {
      const processes = processPort.getBackgroundProcesses();
      if (processes.length === 0) {
        return "当前没有后台进程。";
      }

      const targetProcess = pickBackgroundProcess(processes, pid, command);
      if (!targetProcess) {
        return "未找到匹配的后台进程。";
      }

      return formatBackgroundProcessLogs(targetProcess, maxChars);
    },
    {
      name: "read_background_logs",
      description: "读取后台进程的最近日志。适合在启动开发服务器后检查是否有编译报错或运行时错误。",
      schema: z.object({
        pid: z.number().int().optional().describe("后台进程 PID，可选"),
        command: z.string().optional().describe("命令关键字，可选"),
        maxChars: z.number().int().positive().optional().describe("返回日志的最大字符数"),
      }),
    }
  );

  const listDirectoryTool = tool(
    async ({ directoryPath }: { directoryPath: string }): Promise<string> => {
      const resolvedPath = path.resolve(directoryPath);
      try {
        const files = await fs.readdir(resolvedPath);
        return `目录内容:\n${files.map((f) => `- ${f}`).join("\n")}`;
      } catch (error) {
        const err = error as Error;
        return `列出目录失败: ${sanitizeDisplayText(err.message, resolvedPath)}`;
      }
    },
    {
      name: "list_directory",
      description: "列出指定目录下的所有文件和文件夹",
      schema: z.object({
        directoryPath: z.string().describe("目录路径"),
      }),
    }
  );

  const todoWriteTool = tool(
    async ({ todos }: { todos: Array<{ content: string; status: string }> }): Promise<string> => {
      const validStatuses = ["pending", "in_progress", "completed"];
      for (const item of todos) {
        if (!validStatuses.includes(item.status)) {
          return `无效的任务状态: "${item.status}"，有效值为: ${validStatuses.join(", ")}`;
        }
      }

      todoPort.updateTodos(todos as TodoItem[]);
      return `任务列表已更新。${buildTodoSummary(todos)}`;
    },
    {
      name: "todo_write",
      description: "创建或更新任务列表，用于跟踪多步骤任务的进度。每次调用传入完整的任务列表（全量替换）。",
      schema: z.object({
        todos: z
          .array(
            z.object({
              content: z.string().describe("任务描述（祈使句，如'运行测试'）"),
              status: z
                .enum(["pending", "in_progress", "completed"])
                .describe("任务状态"),
            })
          )
          .describe("完整的任务列表"),
      }),
    }
  );

  return [
    { tool: readFileTool,       modes: [AgentMode.ASK, AgentMode.BUILD, AgentMode.PLAN] },
    { tool: listDirectoryTool,  modes: [AgentMode.ASK, AgentMode.BUILD, AgentMode.PLAN] },
    { tool: writeFileTool,      modes: [AgentMode.BUILD] },
    { tool: writeFilePatchTool, modes: [AgentMode.BUILD] },
    { tool: executeCommandTool, modes: [AgentMode.BUILD] },
    { tool: readBackgroundLogsTool, modes: [AgentMode.BUILD] },
    { tool: todoWriteTool,      modes: [AgentMode.BUILD] },
  ];
}
