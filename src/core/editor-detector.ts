import { execSync, spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync, existsSync } from "fs";
import { tmpdir } from "os";
import { join, basename } from "path";

/**
 * 支持的编辑器类型
 */
export type EditorType = "cursor" | "code" | "idea" | "webstorm" | "nvim";

/**
 * 编辑器配置
 */
interface EditorConfig {
  cmd: string;
  name: string;
  diffArgs: (file1: string, file2: string) => string[];
}

/**
 * 编辑器配置表
 */
const EDITORS: Record<EditorType, EditorConfig> = {
  cursor: {
    cmd: "cursor",
    name: "Cursor",
    diffArgs: (f1, f2) => ["--diff", f1, f2],
  },
  code: {
    cmd: "code",
    name: "VS Code",
    diffArgs: (f1, f2) => ["--diff", f1, f2],
  },
  idea: {
    cmd: "idea",
    name: "IntelliJ IDEA",
    diffArgs: (f1, f2) => ["diff", f1, f2],
  },
  webstorm: {
    cmd: "webstorm",
    name: "WebStorm",
    diffArgs: (f1, f2) => ["diff", f1, f2],
  },
  nvim: {
    cmd: "nvim",
    name: "Neovim",
    diffArgs: (f1, f2) => ["-d", f1, f2],
  },
};

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
 * 通过环境变量检测当前是否在编辑器内置终端中运行
 * 只有确认在编辑器终端中才返回对应类型，独立终端（Terminal.app、iTerm 等）返回 null
 * @returns 当前环境对应的编辑器类型，不在编辑器终端中则返回 null
 */
function detectEditorFromEnv(): EditorType | null {
  const env = process.env;

  // VS Code 和 Cursor 的内置终端都会设置 TERM_PROGRAM=vscode，
  // 只有确认 TERM_PROGRAM 是 vscode 时，才进一步用 CURSOR_ 前缀变量区分两者
  // （CURSOR_ 变量可能通过 shell 配置全局存在，不能单独作为判断依据）
  if (env.TERM_PROGRAM === "vscode") {
    const hasCursorEnv = Object.keys(env).some((key) => key.startsWith("CURSOR_"));
    return hasCursorEnv ? "cursor" : "code";
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
  const tempDir = join(tmpdir(), "niu-code-diff");
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
