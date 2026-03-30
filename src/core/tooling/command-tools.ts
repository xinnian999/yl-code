import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { ConfirmPort, ProcessPort } from "../types.ts";
import {
  executeShellCommand,
  formatBackgroundProcessLogs,
} from "../execution/command-executor.ts";
import { toDisplayCommand } from "../path-display.ts";
import { pickBackgroundProcess } from "./process-utils.ts";

/** 命令执行载荷 */
interface ExecuteCommandPayload {
  /** 原始命令 */
  command: string;
  /** 工作目录 */
  workingDirectory?: string;
  /** 是否后台运行 */
  background?: boolean;
  /** 超时时间 */
  timeoutMs?: number;
}

/** 后台日志读取载荷 */
interface ReadBackgroundLogsPayload {
  /** 后台进程 pid */
  pid?: number;
  /** 命令关键字 */
  command?: string;
  /** 最大返回字符数 */
  maxChars?: number;
}

/** 创建 execute_command 工具 */
export function createExecuteCommandTool(
  confirm: ConfirmPort,
  processPort: ProcessPort
) {
  return tool(
    async ({
      command,
      workingDirectory,
      background = false,
      timeoutMs,
    }: ExecuteCommandPayload): Promise<string> => {
      const cwd = workingDirectory || process.cwd();
      const result = await confirm.requestCommandConfirm(
        command,
        workingDirectory,
        background
      );

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
}

/** 创建 read_background_logs 工具 */
export function createReadBackgroundLogsTool(processPort: ProcessPort) {
  return tool(
    async ({
      pid,
      command,
      maxChars = 4000,
    }: ReadBackgroundLogsPayload): Promise<string> => {
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
}
