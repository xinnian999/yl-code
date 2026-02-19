import { tool } from "@langchain/core/tools";
import type { StructuredToolInterface } from "@langchain/core/tools";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { applyPatch } from "diff";
import { z } from "zod";
import { AgentMode } from "./types.ts";
import type { ConfirmPort, ProcessPort, TodoPort, TodoItem, AgentModeValue } from "./types.ts";

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

/** 构建任务摘要文本 */
function buildTodoSummary(todos: Array<{ status: string }>): string {
  const total = todos.length;
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress").length;
  const pending = todos.filter((t) => t.status === "pending").length;
  return `共 ${total} 项: ${completed} 完成, ${inProgress} 进行中, ${pending} 待处理`;
}

/**
 * 创建工具集，通过端口注入确认和进程管理能力
 * 每个工具绑定支持的模式标签，用于按模式筛选
 */
export function createTools(confirm: ConfirmPort, processPort: ProcessPort, todoPort: TodoPort): ModeTool[] {
  const readFileTool = tool(
    async ({ filePath }: { filePath: string }): Promise<string> => {
      const resolvedPath = path.resolve(filePath);
      try {
        const content = await fs.readFile(resolvedPath, "utf-8");
        return `文件内容:\n${content}`;
      } catch (error) {
        const err = error as Error;
        return `读取文件失败: ${err.message}`;
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
      try {
        let originalContent = "";
        try {
          originalContent = await fs.readFile(resolvedPath, "utf-8");
        } catch {
          // 文件不存在，视为新文件
        }

        if (originalContent === content) {
          return `文件内容未变化，无需写入: ${resolvedPath}`;
        }

        const result = await confirm.requestConfirm(resolvedPath, originalContent, content);

        if (result === "reject") {
          return `用户拒绝了对 ${resolvedPath} 的修改，请根据情况调整方案或询问用户意见`;
        }

        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolvedPath, content, "utf-8");

        const isNewFile = originalContent === "";
        return isNewFile
          ? `文件创建成功: ${resolvedPath}`
          : `文件写入成功: ${resolvedPath}`;
      } catch (error) {
        const err = error as Error;
        return `写入文件失败: ${err.message}`;
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
      try {
        let originalContent = "";
        try {
          originalContent = await fs.readFile(resolvedPath, "utf-8");
        } catch {
          // 文件不存在，视为新文件
        }

        const patchedContent = applyPatch(originalContent, patch);
        if (patchedContent === false) {
          return `补丁应用失败: ${resolvedPath}`;
        }

        if (patchedContent === originalContent) {
          return `文件内容未变化，无需写入: ${resolvedPath}`;
        }

        const result = await confirm.requestConfirm(resolvedPath, originalContent, patchedContent);

        if (result === "reject") {
          return `用户拒绝了对 ${resolvedPath} 的修改，请根据情况调整方案或询问用户意见`;
        }

        const dir = path.dirname(resolvedPath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(resolvedPath, patchedContent, "utf-8");

        const isNewFile = originalContent === "";
        return isNewFile
          ? `文件创建成功: ${resolvedPath}`
          : `文件写入成功: ${resolvedPath}`;
      } catch (error) {
        const err = error as Error;
        return `写入文件失败: ${err.message}`;
      }
    },
    {
      name: "write_file_patch",
      description: "使用统一 diff 补丁写入文件内容，避免传输完整文件。写入前会请求用户确认。",
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
    }: {
      command: string;
      workingDirectory?: string;
      background?: boolean;
    }): Promise<string> => {
      const cwd = workingDirectory || process.cwd();

      const result = await confirm.requestCommandConfirm(command, workingDirectory, background);

      if (result === "reject") {
        return `用户拒绝执行命令: ${command}，请根据情况调整方案或询问用户意见`;
      }

      return new Promise((resolve) => {
        const [cmd, ...args] = command.split(" ");

        if (background) {
          const child = spawn(cmd, args, {
            cwd,
            stdio: "ignore",
            shell: true,
          });

          processPort.registerBackgroundProcess({
            pid: child.pid!,
            command,
            workingDirectory: cwd,
            process: child,
          });

          const cwdInfo = workingDirectory
            ? `\n\n重要提示：命令在目录 "${workingDirectory}" 中后台运行。`
            : "";
          resolve(
            `命令已在后台启动: ${command}${cwdInfo}\n提示：开发服务器正在运行，你可以继续对话。`
          );
          return;
        }

        const child = spawn(cmd, args, {
          cwd,
          stdio: "inherit",
          shell: true,
        });

        let errorMsg = "";

        child.on("error", (error) => {
          errorMsg = error.message;
        });

        child.on("close", (code) => {
          if (code === 0) {
            const cwdInfo = workingDirectory
              ? `\n\n重要提示：命令在目录 "${workingDirectory}" 中执行成功。如果需要在这个项目目录中继续执行命令，请使用 workingDirectory: "${workingDirectory}" 参数，不要使用 cd 命令。`
              : "";
            resolve(`命令执行成功: ${command}${cwdInfo}`);
          } else {
            resolve(
              `命令执行失败，退出码: ${code}${
                errorMsg ? "\n错误: " + errorMsg : ""
              }`
            );
          }
        });
      });
    },
    {
      name: "execute_command",
      description: "执行系统命令，支持指定工作目录，实时显示输出。执行前会请求用户确认。",
      schema: z.object({
        command: z.string().describe("要执行的命令"),
        workingDirectory: z.string().optional().describe("工作目录（推荐指定）"),
        background: z.boolean().optional().describe("是否在后台运行"),
      }),
    }
  );

  const listDirectoryTool = tool(
    async ({ directoryPath }: { directoryPath: string }): Promise<string> => {
      try {
        const files = await fs.readdir(directoryPath);
        return `目录内容:\n${files.map((f) => `- ${f}`).join("\n")}`;
      } catch (error) {
        const err = error as Error;
        return `列出目录失败: ${err.message}`;
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
    async ({ todos }: { todos: Array<{ content: string; status: string; activeForm: string }> }): Promise<string> => {
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
        todos: z.array(
          z.object({
            content: z.string().describe("任务描述（祈使句，如'运行测试'）"),
            status: z.enum(["pending", "in_progress", "completed"]).describe("任务状态"),
            activeForm: z.string().describe("进行中的描述（现在进行时，如'正在运行测试'）"),
          })
        ).describe("完整的任务列表"),
      }),
    }
  );

  return [
    { tool: readFileTool,       modes: [AgentMode.ASK, AgentMode.BUILD] },
    { tool: listDirectoryTool,  modes: [AgentMode.ASK, AgentMode.BUILD] },
    { tool: writeFileTool,      modes: [AgentMode.BUILD] },
    { tool: writeFilePatchTool, modes: [AgentMode.BUILD] },
    { tool: executeCommandTool, modes: [AgentMode.BUILD] },
    { tool: todoWriteTool,      modes: [AgentMode.BUILD] },
  ];
}
