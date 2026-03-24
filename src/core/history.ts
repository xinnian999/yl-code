import fs from "fs";
import { HISTORY_FILE, MAX_HISTORY, NIUMA_CONFIG_DIR } from "./config/storage-config.ts";

/**
 * 确保配置目录存在
 */
const ensureConfigDir = (): void => {
  if (!fs.existsSync(NIUMA_CONFIG_DIR)) {
    fs.mkdirSync(NIUMA_CONFIG_DIR, { recursive: true });
  }
};

/**
 * 加载历史记录
 */
export const loadHistory = (): string[] => {
  try {
    ensureConfigDir();
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    // 读取失败时返回空数组
    const err = error as Error;
    console.error("加载历史记录失败:", err.message);
  }
  return [];
};

/**
 * 保存历史记录
 */
export const saveHistory = (history: string[]): void => {
  try {
    ensureConfigDir();
    // 只保留最近的 MAX_HISTORY 条记录
    const trimmed = history.slice(-MAX_HISTORY);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  } catch (error) {
    const err = error as Error;
    console.error("保存历史记录失败:", err.message);
  }
};

/**
 * 添加一条历史记录
 */
export const addToHistory = (history: string[], command: string): string[] => {
  // 避免重复添加相同命令
  if (history.length > 0 && history[history.length - 1] === command) {
    return history;
  }
  const newHistory = [...history, command];
  saveHistory(newHistory);
  return newHistory;
};
