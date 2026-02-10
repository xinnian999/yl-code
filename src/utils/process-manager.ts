import type { ChildProcess } from "child_process";

/**
 * 后台进程信息类型
 */
export interface ProcessInfo {
  pid: number;
  command: string;
  workingDirectory: string;
  process: ChildProcess;
}

// 后台进程跟踪列表
const backgroundProcesses: ProcessInfo[] = [];

/**
 * 注册一个后台进程
 */
export function registerBackgroundProcess(processInfo: ProcessInfo): void {
  backgroundProcesses.push(processInfo);

  // 监听进程退出，从列表中移除
  processInfo.process.on("exit", () => {
    const index = backgroundProcesses.findIndex((p) => p.pid === processInfo.pid);
    if (index !== -1) {
      backgroundProcesses.splice(index, 1);
    }
  });
}

/**
 * 清理所有后台进程
 */
export async function cleanupBackgroundProcesses(): Promise<void> {
  if (backgroundProcesses.length === 0) {
    return;
  }

  console.log(`\n🧹 正在清理 ${backgroundProcesses.length} 个后台进程...`);

  const cleanupPromises = backgroundProcesses.map(({ pid, command, process: child }) => {
    return new Promise<void>((resolve) => {
      // 检查进程是否还在运行
      try {
        // 尝试优雅终止
        child.kill("SIGTERM");
        
        // 等待进程退出，最多等待 2 秒
        const timeout = setTimeout(() => {
          try {
            // 如果超时，强制终止
            child.kill("SIGKILL");
            console.log(`  ✓ 已强制终止进程 ${pid} (${command})`);
          } catch (killError) {
            const err = killError as Error;
            console.log(`  ✗ 无法终止进程 ${pid} (${command}): ${err.message}`);
          }
          resolve();
        }, 2000);

        child.once("exit", () => {
          clearTimeout(timeout);
          console.log(`  ✓ 已终止进程 ${pid} (${command})`);
          resolve();
        });
      } catch (error) {
        // 如果进程已经退出或无法访问
        console.log(`  ⚠ 进程 ${pid} (${command}) 可能已退出`);
        resolve();
      }
    });
  });

  // 等待所有进程清理完成
  await Promise.all(cleanupPromises);

  // 清空列表
  backgroundProcesses.length = 0;
}

// 清理标志，防止重复清理
let isCleaning = false;

/**
 * 清理所有后台进程并退出程序
 */
export async function cleanup(): Promise<void> {
  if (isCleaning) return;
  isCleaning = true;
  
  await cleanupBackgroundProcesses();
  process.exit(0);
}
