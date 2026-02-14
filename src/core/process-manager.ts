import type { ProcessPort, ProcessInfo } from "./types.ts";

export class ProcessManager implements ProcessPort {
  private backgroundProcesses: ProcessInfo[] = [];
  private isCleaning = false;

  registerBackgroundProcess(processInfo: ProcessInfo): void {
    this.backgroundProcesses.push(processInfo);

    processInfo.process.on("exit", () => {
      const index = this.backgroundProcesses.findIndex(
        (p) => p.pid === processInfo.pid
      );
      if (index !== -1) {
        this.backgroundProcesses.splice(index, 1);
      }
    });
  }

  async cleanupAll(): Promise<void> {
    if (this.backgroundProcesses.length === 0) return;

    console.log(
      `\n🧹 正在清理 ${this.backgroundProcesses.length} 个后台进程...`
    );

    const cleanupPromises = this.backgroundProcesses.map(
      ({ pid, command, process: child }) => {
        return new Promise<void>((resolve) => {
          try {
            child.kill("SIGTERM");

            const timeout = setTimeout(() => {
              try {
                child.kill("SIGKILL");
                console.log(`  ✓ 已强制终止进程 ${pid} (${command})`);
              } catch (killError) {
                const err = killError as Error;
                console.log(
                  `  ✗ 无法终止进程 ${pid} (${command}): ${err.message}`
                );
              }
              resolve();
            }, 2000);

            child.once("exit", () => {
              clearTimeout(timeout);
              console.log(`  ✓ 已终止进程 ${pid} (${command})`);
              resolve();
            });
          } catch {
            console.log(`  ⚠ 进程 ${pid} (${command}) 可能已退出`);
            resolve();
          }
        });
      }
    );

    await Promise.all(cleanupPromises);
    this.backgroundProcesses.length = 0;
  }

  async cleanup(): Promise<void> {
    if (this.isCleaning) return;
    this.isCleaning = true;
    await this.cleanupAll();
    process.exit(0);
  }
}
