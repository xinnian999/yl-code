import type { ProcessPort } from "../types.ts";

/** 按 pid 或命令关键字选择要查看的后台进程 */
export function pickBackgroundProcess(
  processes: ReturnType<ProcessPort["getBackgroundProcesses"]>,
  pid?: number,
  command?: string
) {
  if (typeof pid === "number") {
    return processes.find((processInfo) => processInfo.pid === pid) || null;
  }

  if (command && command.trim()) {
    const normalizedCommand = command.trim().toLowerCase();
    const matchedProcesses = processes.filter((processInfo) => {
      return processInfo.command.toLowerCase().includes(normalizedCommand);
    });
    return matchedProcesses.at(-1) || null;
  }

  const runningProcess = [...processes]
    .reverse()
    .find((processInfo) => processInfo.status === "running");
  return runningProcess || processes.at(-1) || null;
}
