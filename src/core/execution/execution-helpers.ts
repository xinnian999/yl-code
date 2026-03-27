import path from "node:path";
import { toDisplayCommand, toDisplayPath } from "../path-display.ts";
import { ExecutionPhase, type ExecutionPhaseValue } from "./execution-types.ts";

/** 最大跟踪文件数量 */
export const MAX_TRACKED_FILES = 6;

/** 失败信号关键字 */
const FAILURE_MARKERS = [
  "命令执行失败",
  "命令执行超时",
  "error",
  "failed",
  "失败",
  "报错",
  "异常",
];

/** 预览文本，避免提示词里塞入过长原文 */
export function previewText(text: string, maxChars = 80): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}

/** 将文件路径归一化为绝对路径 */
export function normalizeFilePath(filePath: unknown): string | null {
  if (typeof filePath !== "string" || !filePath.trim()) return null;
  return path.resolve(filePath);
}

/** 向列表尾部追加去重项，并裁剪为固定长度 */
export function pushUniqueItem(items: string[], value: string): string[] {
  const nextItems = items.filter((item) => item !== value);
  nextItems.push(value);
  return nextItems.slice(-MAX_TRACKED_FILES);
}

/** 从命令输出中提取相关文件路径 */
export function extractRelatedFiles(text: string): string[] {
  const filePattern = /(?:^|[\s(])((?:\.{0,2}\/)?[\w./-]+\.(?:ts|tsx|js|jsx|vue|css|scss|json|html))(?:[:(]\d+)?/g;
  const relatedFiles: string[] = [];

  for (const match of text.matchAll(filePattern)) {
    const rawFile = match[1];
    if (!rawFile) continue;
    const normalizedFile = path.resolve(rawFile);
    if (relatedFiles.includes(normalizedFile)) continue;
    relatedFiles.push(normalizedFile);
    if (relatedFiles.length >= MAX_TRACKED_FILES) break;
  }

  return relatedFiles;
}

/** 判断输出里是否存在明确失败信号 */
export function hasFailureSignal(text: string): boolean {
  const normalized = text.toLowerCase();
  return FAILURE_MARKERS.some((marker) => normalized.includes(marker.toLowerCase()));
}

/** 判断命令是否为验证类命令 */
export function isValidationCommand(command: string): boolean {
  return /\bbun\s+run\s+(build|typecheck|test)\b/i.test(command);
}

/** 判断命令是否为开发服务器命令 */
export function isDevCommand(command: string): boolean {
  return /\bbun\s+(run\s+)?dev\b/i.test(command);
}

/** 判断命令是否为脚手架初始化命令 */
export function isScaffoldCommand(command: string): boolean {
  return /\bbun\s+(create|install)\b/i.test(command);
}

/** 根据文件路径推断当前更适合的执行阶段和焦点 */
export function getFileExecutionHint(filePath: string): {
  phase: ExecutionPhaseValue;
  focusSummary: string;
} {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const baseName = path.basename(normalizedPath);

  if (/^(package\.json|bun\.lock|tsconfig|vite\.config|index\.html)/.test(baseName)) {
    return {
      phase: ExecutionPhase.SCAFFOLD,
      focusSummary: `正在调整脚手架与工程配置：${toDisplayPath(filePath)}`,
    };
  }

  if (
    normalizedPath.includes("/types/")
    || normalizedPath.includes("/hooks/")
    || normalizedPath.includes("/store/")
    || normalizedPath.includes("/utils/")
  ) {
    return {
      phase: ExecutionPhase.FOUNDATION,
      focusSummary: `正在完善基础类型或状态层：${toDisplayPath(filePath)}`,
    };
  }

  if (baseName.startsWith("App.")) {
    return {
      phase: ExecutionPhase.MODULE,
      focusSummary: `正在联调应用入口与主页面：${toDisplayPath(filePath)}`,
    };
  }

  return {
    phase: ExecutionPhase.MODULE,
    focusSummary: `正在实现单个模块或组件：${toDisplayPath(filePath)}`,
  };
}

/** 构造失败签名，用于统计连续失败次数 */
export function buildFailureKey(command: string, relatedFiles: string[]): string {
  if (relatedFiles.length === 0) {
    return previewText(command, 40);
  }
  return relatedFiles.join("|");
}

/** 获取执行阶段的中文标签 */
export function getExecutionPhaseLabel(phase: ExecutionPhaseValue): string {
  const phaseLabels: Record<ExecutionPhaseValue, string> = {
    [ExecutionPhase.DISCOVERY]: "探索分析",
    [ExecutionPhase.SCAFFOLD]: "脚手架初始化",
    [ExecutionPhase.FOUNDATION]: "基础结构",
    [ExecutionPhase.MODULE]: "模块实现",
    [ExecutionPhase.VALIDATION]: "联调验证",
    [ExecutionPhase.REPAIR]: "定点修复",
    [ExecutionPhase.COMPLETE]: "完成收尾",
  };

  return phaseLabels[phase];
}

/** 将命令格式化为展示文案 */
export function formatExecutionCommand(command: string): string {
  return toDisplayCommand(command);
}

/** 将文件列表格式化为展示文案 */
export function formatExecutionFiles(files: string[]): string {
  if (files.length === 0) return "暂无";
  return files.map((file) => toDisplayPath(file)).join("、");
}
