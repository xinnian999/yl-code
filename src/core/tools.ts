import { tool } from "@langchain/core/tools";
import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { z } from "zod";
import type { ConfirmPort, ProcessPort } from "./types.ts";

/**
 * 创建工具集，通过端口注入确认和进程管理能力
 */
export function createTools(confirm: ConfirmPort, processPort: ProcessPort) {
  const readFileTool = tool(
    async ({ filePath }: { filePath: string }): Promise<string> => {
      try {
        const content = await fs.readFile(filePath, "utf-8");
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
      try {
        let originalContent = "";
        try {
          originalContent = await fs.readFile(filePath, "utf-8");
        } catch {
          // 文件不存在，视为新文件
        }

        if (originalContent === content) {
          return `文件内容未变化，无需写入: ${filePath}`;
        }

        const result = await confirm.requestConfirm(filePath, originalContent, content);

        if (result === "reject") {
          return `用户拒绝了对 ${filePath} 的修改，请根据情况调整方案或询问用户意见`;
        }

        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        await fs.writeFile(filePath, content, "utf-8");

        const isNewFile = originalContent === "";
        return isNewFile
          ? `文件创建成功: ${filePath}`
          : `文件写入成功: ${filePath}`;
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

  return [readFileTool, writeFileTool, executeCommandTool, listDirectoryTool];
}
