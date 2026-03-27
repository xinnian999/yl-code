import { spawn } from "node:child_process";
import type {
  BackgroundProcessSnapshot,
  ProcessInfo,
  ProcessPort,
} from "./types.ts";
import { sanitizeDisplayText, toDisplayCommand, toDisplayPath } from "./path-display.ts";

/** 前台命令默认超时时间 */
const DEFAULT_COMMAND_TIMEOUT_MS = 90000;
/** 后台命令启动观测时间 */
const BACKGROUND_STARTUP_WAIT_MS = 1500;
/** 单个后台进程的最大日志缓存长度 */
const MAX_PROCESS_OUTPUT_CHARS = 12000;
/** 单次展示的最大日志长度 */
const MAX_DISPLAY_OUTPUT_CHARS = 4000;

/** 命令执行参数 */
export interface CommandExecutionOptions {
  /** 原始命令 */
  command: string;
  /** 工作目录 */
  workingDirectory: string;
  /** 是否后台运行 */
  background?: boolean;
  /** 超时时间 */
  timeoutMs?: number;
  /** 进程端口 */
  processPort: ProcessPort;
}

/** 判断是否像开发服务器命令 */
export function isLikelyDevServerCommand(command: string): boolean {
  const normalized = command.toLowerCase();
  return [
    /\bbun\s+(run\s+)?dev\b/,
    /\bbunx?\s+vite\b/,
    /\bpnpm\s+(run\s+)?dev\b/,
    /\bnpm\s+run\s+dev\b/,
    /\byarn\s+dev\b/,
    /\bnext\s+dev\b/,
  ].some((pattern) => pattern.test(normalized));
}

/** 将日志裁剪到固定长度 */
function trimOutput(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(text.length - maxChars);
}

/** 追加后台进程输出 */
function appendProcessOutput(processInfo: ProcessInfo, chunk: string): void {
  processInfo.output = trimOutput(processInfo.output + chunk, MAX_PROCESS_OUTPUT_CHARS);
}

/** 归一化命令输出文本 */
function normalizeCommandOutput(output: string, cwd: string): string {
  const trimmedOutput = output.trim();
  if (!trimmedOutput) return "无输出";
  const sanitized = sanitizeDisplayText(trimmedOutput, cwd);
  return trimOutput(sanitized || trimmedOutput, MAX_DISPLAY_OUTPUT_CHARS);
}

/** 格式化命令输出结果 */
function formatCommandOutput(stdout: string, stderr: string, cwd: string): string {
  const normalizedStdout = normalizeCommandOutput(stdout, cwd);
  const normalizedStderr = normalizeCommandOutput(stderr, cwd);

  if (normalizedStdout === "无输出" && normalizedStderr === "无输出") {
    return "无输出";
  }

  if (normalizedStderr === "无输出") {
    return `输出:\n${normalizedStdout}`;
  }

  if (normalizedStdout === "无输出") {
    return `错误输出:\n${normalizedStderr}`;
  }

  return `标准输出:\n${normalizedStdout}\n\n错误输出:\n${normalizedStderr}`;
}

/** 格式化后台进程日志 */
export function formatBackgroundProcessLogs(
  snapshot: BackgroundProcessSnapshot,
  maxChars = MAX_DISPLAY_OUTPUT_CHARS
): string {
  const output = normalizeCommandOutput(snapshot.output, snapshot.workingDirectory);
  const statusText = snapshot.status === "running" ? "运行中" : `已退出(${snapshot.exitCode ?? "未知"})`;
  const logText = trimOutput(output, maxChars);

  return [
    `PID: ${snapshot.pid}`,
    `状态: ${statusText}`,
    `命令: ${toDisplayCommand(snapshot.command)}`,
    `目录: ${toDisplayPath(snapshot.workingDirectory)}`,
    `日志:\n${logText}`,
  ].join("\n");
}

/** 执行前台命令并回传输出 */
function runForegroundCommand(options: CommandExecutionOptions): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS;
  const displayCommand = toDisplayCommand(options.command);
  const displayDirectory = toDisplayPath(options.workingDirectory);

  return new Promise((resolve) => {
    const child = spawn(options.command, {
      cwd: options.workingDirectory,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    child.stdout?.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
    });

    child.on("error", (error) => {
      resolve(`命令执行失败: ${displayCommand}\n错误: ${sanitizeDisplayText(error.message, options.workingDirectory)}`);
    });

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.on("close", (code) => {
      clearTimeout(timer);
      const output = formatCommandOutput(stdout, stderr, options.workingDirectory);
      const prefix = timedOut
        ? `命令执行超时（${Math.round(timeoutMs / 1000)}秒）: ${displayCommand}\n目录: ${displayDirectory}`
        : code === 0
          ? `命令执行成功: ${displayCommand}\n目录: ${displayDirectory}`
          : `命令执行失败，退出码: ${code}: ${displayCommand}\n目录: ${displayDirectory}`;
      resolve(`${prefix}\n${output}`);
    });
  });
}

/** 启动后台命令并回传初始日志 */
function runBackgroundCommand(options: CommandExecutionOptions): Promise<string> {
  const child = spawn(options.command, {
    cwd: options.workingDirectory,
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const processInfo: ProcessInfo = {
    pid: child.pid ?? Date.now(),
    command: options.command,
    workingDirectory: options.workingDirectory,
    process: child,
    status: "running",
    exitCode: null,
    output: "",
    startedAt: Date.now(),
  };
  options.processPort.registerBackgroundProcess(processInfo);

  child.stdout?.on("data", (chunk) => appendProcessOutput(processInfo, String(chunk)));
  child.stderr?.on("data", (chunk) => appendProcessOutput(processInfo, String(chunk)));

  return new Promise((resolve) => {
    let settled = false;
    const finish = (message: string) => {
      if (settled) return;
      settled = true;
      resolve(message);
    };

    child.on("error", (error) => {
      processInfo.status = "exited";
      processInfo.exitCode = -1;
      appendProcessOutput(processInfo, `\n${error.message}`);
      finish(`后台命令启动失败: ${toDisplayCommand(options.command)}\n${formatBackgroundProcessLogs(processInfo)}`);
    });

    child.on("close", (code) => {
      processInfo.status = "exited";
      processInfo.exitCode = code;
      if (settled) return;
      const statusText = code === 0 ? "后台命令已结束" : "后台命令启动后异常退出";
      finish(`${statusText}: ${toDisplayCommand(options.command)}\n${formatBackgroundProcessLogs(processInfo)}`);
    });

    setTimeout(() => {
      if (processInfo.status !== "running") return;
      finish(
        `命令已在后台启动: ${toDisplayCommand(options.command)}\n${formatBackgroundProcessLogs(processInfo)}\n如需继续检查，请调用 read_background_logs。`
      );
    }, BACKGROUND_STARTUP_WAIT_MS);
  });
}

/** 执行命令并根据模式返回结果 */
export async function executeShellCommand(
  options: CommandExecutionOptions
): Promise<string> {
  if (!options.background && isLikelyDevServerCommand(options.command)) {
    return [
      `检测到开发服务器命令: ${toDisplayCommand(options.command)}`,
      "这类命令必须使用 background: true 后台运行，否则会长时间占用当前轮次。",
      "启动后请使用 read_background_logs 检查初始日志，并继续运行 bun 的构建或类型检查命令验证是否报错。",
    ].join("\n");
  }

  if (options.background) {
    return runBackgroundCommand(options);
  }
  return runForegroundCommand(options);
}
