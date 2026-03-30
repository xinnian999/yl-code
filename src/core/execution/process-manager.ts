import type { ProcessPort, ProcessInfo } from "../types.ts";

/**
 * 后台进程管理器 - 注册、跟踪和清理后台子进程
 */
export class ProcessManager implements ProcessPort {
  /** 已注册的后台进程列表 */
  private backgroundProcesses: ProcessInfo[] = [];
  /** 是否正在执行清理 */
  private isCleaning = false;

  /** 注册后台进程，保留其状态和日志供后续排查 */
  registerBackgroundProcess(processInfo: ProcessInfo): void {
    this.backgroundProcesses.push(processInfo);
  }

  /** 获取后台进程快照列表 */
  getBackgroundProcesses() {
    return this.backgroundProcesses.map((processInfo) => ({
      pid: processInfo.pid,
      command: processInfo.command,
      workingDirectory: processInfo.workingDirectory,
      status: processInfo.status,
      exitCode: processInfo.exitCode,
      output: processInfo.output,
      startedAt: processInfo.startedAt,
    }));
  }

  /** 终止单个进程（先 SIGTERM，超时后 SIGKILL） */
  private terminateProcess(pid: number, command: string, child: ProcessInfo["process"]): Promise<void> {
    return new Promise<void>((resolve) => {
      try {
        child.kill("SIGTERM");
      } catch {
        console.log(`  ⚠ 进程 ${pid} (${command}) 可能已退出`);
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        this.forceKill(pid, command, child);
        resolve();
      }, 2000);

      child.once("exit", () => {
        clearTimeout(timeout);
        console.log(`  ✓ 已终止进程 ${pid} (${command})`);
        resolve();
      });
    });
  }

  /** 强制终止进程（SIGKILL） */
  private forceKill(pid: number, command: string, child: ProcessInfo["process"]): void {
    try {
      child.kill("SIGKILL");
      console.log(`  ✓ 已强制终止进程 ${pid} (${command})`);
    } catch (killError) {
      const err = killError as Error;
      console.log(`  ✗ 无法终止进程 ${pid} (${command}): ${err.message}`);
    }
  }

  /** 清理所有后台进程（先 SIGTERM，超时后 SIGKILL） */
  async cleanupAll(): Promise<void> {
    const runningProcesses = this.backgroundProcesses.filter(
      (processInfo) => processInfo.status === "running"
    );
    if (runningProcesses.length === 0) return;

    console.log(
      `\n🧹 正在清理 ${runningProcesses.length} 个后台进程...`
    );

    const cleanupPromises = runningProcesses.map(
      ({ pid, command, process: child }) => this.terminateProcess(pid, command, child)
    );

    await Promise.all(cleanupPromises);
  }

  /** 执行清理并退出进程 */
  async cleanup(): Promise<void> {
    if (this.isCleaning) return;
    this.isCleaning = true;
    await this.cleanupAll();
    process.exit(0);
  }
}
