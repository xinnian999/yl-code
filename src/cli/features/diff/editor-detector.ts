import { execSync, spawn } from "child_process";
import { writeFileSync, unlinkSync, mkdirSync } from "fs";
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
 * 检测顺序（优先检测 Cursor）
 */
const DETECTION_ORDER: EditorType[] = ["cursor", "code", "idea", "webstorm", "nvim"];

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
 * 检测可用的编辑器
 * @returns 检测到的编辑器类型，如果都不可用则返回 null
 */
export function detectEditor(): EditorType | null {
  for (const editor of DETECTION_ORDER) {
    if (isCommandAvailable(EDITORS[editor].cmd)) {
      return editor;
    }
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
 */
function createTempFile(content: string, originalPath: string): string {
  const tempDir = join(tmpdir(), "niu-code-diff");
  mkdirSync(tempDir, { recursive: true });
  
  const fileName = `${Date.now()}-${basename(originalPath)}`;
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
 * @param editor 编辑器类型
 * @param originalPath 原文件路径
 * @param newContent 新内容
 * @returns 临时文件路径（用于后续清理）
 */
export function openDiffInEditor(
  editor: EditorType,
  originalPath: string,
  newContent: string
): string | null {
  const config = EDITORS[editor];
  
  // 创建临时文件存放新内容
  const tempPath = createTempFile(newContent, originalPath);
  
  try {
    const args = config.diffArgs(originalPath, tempPath);
    
    // 启动编辑器（不等待）
    const child = spawn(config.cmd, args, {
      detached: true,
      stdio: "ignore",
    });
    
    // 解除父进程引用，让子进程独立运行
    child.unref();
    
    return tempPath;
  } catch {
    cleanupTempFile(tempPath);
    return null;
  }
}

/**
 * 尝试在检测到的编辑器中打开 diff
 * @returns { editor, tempPath } 或 null（如果没有可用编辑器）
 */
export function tryOpenDiff(
  originalPath: string,
  newContent: string
): { editor: EditorType; tempPath: string } | null {
  const editor = detectEditor();
  if (!editor) {
    return null;
  }
  
  const tempPath = openDiffInEditor(editor, originalPath, newContent);
  if (!tempPath) {
    return null;
  }
  
  return { editor, tempPath };
}
