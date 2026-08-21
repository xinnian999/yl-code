import { spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { buildProject, rootDirectory } from "./build.mjs";

const watchTargets = [
  join(rootDirectory, "src"),
  join(rootDirectory, ".agents"),
  join(rootDirectory, "skills-lock.json"),
];

let childProcess = null;
let restartTimer = null;
let isBuilding = false;
let hasQueuedBuild = false;

/** 递归收集开发期需要关注的文件状态 */
function collectWatchState(target) {
  if (!existsSync(target)) return [];
  const stats = statSync(target);
  if (!stats.isDirectory()) return [`${target}:${stats.mtimeMs}:${stats.size}`];

  return readdirSync(target, { withFileTypes: true }).flatMap((entry) =>
    collectWatchState(join(target, entry.name)),
  );
}

/** 生成稳定的源码快照，用轮询避免递归监听耗尽文件句柄 */
function createWatchSnapshot() {
  return watchTargets.flatMap(collectWatchState).sort().join("\n");
}

/** 结束当前 CLI 子进程 */
function stopChildProcess() {
  if (!childProcess || childProcess.killed) return;
  childProcess.kill("SIGTERM");
  childProcess = null;
}

/** 构建并重新启动 CLI */
async function restartCli() {
  if (isBuilding) {
    hasQueuedBuild = true;
    return;
  }

  isBuilding = true;
  stopChildProcess();
  try {
    await buildProject();
    childProcess = spawn(process.execPath, [join(rootDirectory, "dist", "index.js")], {
      cwd: rootDirectory,
      stdio: "inherit",
    });
  } catch (error) {
    console.error("开发构建失败：", error);
  } finally {
    isBuilding = false;
    if (hasQueuedBuild) {
      hasQueuedBuild = false;
      await restartCli();
    }
  }
}

/** 合并短时间内连续产生的文件变更 */
function scheduleRestart() {
  if (restartTimer) clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    void restartCli();
  }, 150);
}

let watchSnapshot = createWatchSnapshot();
const watchTimer = setInterval(() => {
  const nextSnapshot = createWatchSnapshot();
  if (nextSnapshot === watchSnapshot) return;
  watchSnapshot = nextSnapshot;
  scheduleRestart();
}, 500);

/** 关闭监听器和子进程 */
function shutdown() {
  clearInterval(watchTimer);
  stopChildProcess();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await restartCli();
