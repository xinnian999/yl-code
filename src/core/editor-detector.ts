import { execSync, spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, basename } from "path";
import {
  DIFF_TEMP_DIR_NAME,
  EDITORS,
  PROCESS_TREE_MAX_DEPTH,
  TERMINAL_EDITOR_COMMANDS,
} from "./config/editor-config.ts";

export type { EditorType } from "./config/editor-config.ts";
import type { EditorType } from "./config/editor-config.ts";

/**
 * 检测命令是否可用
 */
function isCommandAvailable(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * 从进程树中提取可能的编辑器类型（主要用于区分 VS Code 系编辑器）
 */
function detectEditorFromProcessTree(): EditorType | null {
  // 该方式依赖 ps 命令，Windows 下可能不可用
  if (process.platform === "win32") {
    return null;
  }

  let pid = process.ppid;
  for (let depth = 0; depth < PROCESS_TREE_MAX_DEPTH; depth++) {
    try {
      const comm = execSync(`ps -p ${pid} -o comm=`, { encoding: "utf-8" }).trim().toLowerCase();
      const cmd = basename(comm);

      if (cmd.includes("cursor")) {
        return "cursor";
      }
      if (cmd.includes("trae")) {
        return "trae";
      }
      if (cmd === "code" || cmd === "code-insiders" || cmd.includes("vscode")) {
        return "code";
      }
      if (cmd.includes("webstorm")) {
        return "webstorm";
      }
      if (cmd.includes("idea")) {
        return "idea";
      }
      if (cmd === "nvim") {
        return "nvim";
      }

      const ppidRaw = execSync(`ps -p ${pid} -o ppid=`, { encoding: "utf-8" }).trim();
      const parentPid = Number.parseInt(ppidRaw, 10);
      if (!Number.isFinite(parentPid) || parentPid <= 1 || parentPid === pid) {
        break;
      }
      pid = parentPid;
    } catch {
      break;
    }
  }

  return null;
}

/**
 * 通过环境变量检测当前是否在编辑器内置终端中运行
 * 只有确认在编辑器终端中才返回对应类型，独立终端（Terminal.app、iTerm 等）返回 null
 * @returns 当前环境对应的编辑器类型，不在编辑器终端中则返回 null
 */
function detectEditorFromEnv(): EditorType | null {
  const env = process.env;

  // VS Code / Cursor / Trae 都可能设置 TERM_PROGRAM=vscode，需做更细粒度识别
  if (env.TERM_PROGRAM === "vscode") {
    const envKeys = Object.keys(env);
    const hasCursorEnv = envKeys.some((key) => key.startsWith("CURSOR_"));
    const hasTraeEnv = envKeys.some((key) => key.startsWith("TRAE_"));

    // 优先使用进程树判断，规避用户 shell 中注入全局 CURSOR_/TRAE_ 变量导致误判
    const fromProcessTree = detectEditorFromProcessTree();
    if (fromProcessTree === "cursor" || fromProcessTree === "trae" || fromProcessTree === "code") {
      return fromProcessTree;
    }

    if (hasTraeEnv) {
      return "trae";
    }
    if (hasCursorEnv) {
      return "cursor";
    }
    return "code";
  }

  // JetBrains 系列（IDEA / WebStorm）内置终端
  if (env.TERMINAL_EMULATOR === "JetBrains-JetBrains") {
    const ideaEnv = env.__INTELLIJ_COMMAND_HISTFILE__ ?? "";
    if (ideaEnv.toLowerCase().includes("webstorm")) {
      return "webstorm";
    }
    return "idea";
  }

  // Neovim 内置终端: NVIM 环境变量存在
  if (env.NVIM) {
    return "nvim";
  }

  return null;
}

/**
 * 检测可用的编辑器
 * 仅当用户在编辑器内置终端中运行时才返回对应编辑器，
 * 在独立终端中运行则返回 null，由调用方兜底在终端内显示 diff
 * @returns 检测到的编辑器类型，如果不在编辑器终端中则返回 null
 */
export function detectEditor(): EditorType | null {
  const editor = detectEditorFromEnv();
  if (editor && isCommandAvailable(EDITORS[editor].cmd)) {
    return editor;
  }
  return null;
}

/**
 * 获取编辑器名称
 */
export function getEditorName(editor: EditorType): string {
  return EDITORS[editor].name;
}

/**
 * 创建临时文件用于 diff 展示
 * @param content 文件内容
 * @param originalPath 原始文件路径（用于提取文件名）
 * @param prefix 文件名前缀，用于区分同时创建的多个临时文件
 */
function createTempFile(content: string, originalPath: string, prefix = ""): string {
  const tempDir = join(tmpdir(), DIFF_TEMP_DIR_NAME);
  mkdirSync(tempDir, { recursive: true });

  const fileName = `${prefix}${Date.now()}-${basename(originalPath)}`;
  const tempPath = join(tempDir, fileName);
  writeFileSync(tempPath, content, "utf-8");
  return tempPath;
}

/**
 * 清理临时文件
 */
export function cleanupTempFile(tempPath: string): void {
  try {
    unlinkSync(tempPath);
  } catch {
    // 忽略清理失败
  }
}

/**
 * 在编辑器中打开 diff 视图
 * 当原文件不存在（新文件场景）时，会创建空的临时文件作为 diff 左侧
 * @param editor 编辑器类型
 * @param originalPath 原文件路径
 * @param newContent 新内容
 * @returns 临时文件路径数组（用于后续清理），失败返回 null
 */
export function openDiffInEditor(
  editor: EditorType,
  originalPath: string,
  newContent: string
): string[] | null {
  const config = EDITORS[editor];
  const tempFiles: string[] = [];

  // 创建临时文件存放新内容
  const tempNewPath = createTempFile(newContent, originalPath, "modified-");
  tempFiles.push(tempNewPath);

  // 原文件不存在时（新文件），创建空临时文件作为 diff 左侧
  let leftPath = originalPath;
  if (!existsSync(originalPath)) {
    leftPath = createTempFile("", originalPath, "original-");
    tempFiles.push(leftPath);
  }

  try {
    const args = config.diffArgs(leftPath, tempNewPath);

    // 启动编辑器（不等待）
    const child = spawn(config.cmd, args, {
      detached: true,
      stdio: "ignore",
    });

    // 解除父进程引用，让子进程独立运行
    child.unref();

    return tempFiles;
  } catch {
    tempFiles.forEach(cleanupTempFile);
    return null;
  }
}

/**
 * 尝试在检测到的编辑器中打开 diff
 * @returns { editor, tempFiles } 或 null（如果没有可用编辑器）
 */
export function tryOpenDiff(
  originalPath: string,
  newContent: string
): { editor: EditorType; tempFiles: string[] } | null {
  const editor = detectEditor();
  if (!editor) {
    return null;
  }

  const tempFiles = openDiffInEditor(editor, originalPath, newContent);
  if (!tempFiles) {
    return null;
  }

  return { editor, tempFiles };
}

/**
 * 在编辑器中打开单个文件进行编辑
 * 优先使用检测到的编辑器，否则使用 $EDITOR 或系统默认方式
 * @param filePath 要打开的文件路径
 * @returns 使用的编辑器名称，失败返回 null
 */
export function openFileInEditor(filePath: string): string | null {
  // 优先使用检测到的编辑器（Trae / VS Code / Cursor / IDEA / WebStorm / Neovim）
  const editor = detectEditor();
  if (editor) {
    const config = EDITORS[editor];
    try {
      const child = spawn(config.cmd, [filePath], { detached: true, stdio: "ignore" });
      child.unref();
      return config.name;
    } catch {
      // 继续尝试其他方式
    }
  }

  // 尝试使用 $EDITOR 环境变量（非终端编辑器）
  const envEditor = process.env.EDITOR || "";
  if (envEditor && !TERMINAL_EDITOR_COMMANDS.includes(basename(envEditor))) {
    try {
      const child = spawn(envEditor, [filePath], { detached: true, stdio: "ignore" });
      child.unref();
      return basename(envEditor);
    } catch {
      // 继续尝试
    }
  }

  // macOS 兜底：用系统默认应用打开
  if (process.platform === "darwin") {
    try {
      const child = spawn("open", ["-t", filePath], { detached: true, stdio: "ignore" });
      child.unref();
      return "系统编辑器";
    } catch {
      return null;
    }
  }

  // Linux 兜底：xdg-open
  if (process.platform === "linux") {
    try {
      const child = spawn("xdg-open", [filePath], { detached: true, stdio: "ignore" });
      child.unref();
      return "系统编辑器";
    } catch {
      return null;
    }
  }

  return null;
}
