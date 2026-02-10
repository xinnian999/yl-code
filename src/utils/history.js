import fs from "fs";
import path from "path";
import os from "os";

// 历史文件路径：~/.niu-code/history.json
const CONFIG_DIR = path.join(os.homedir(), ".niu-code");
const HISTORY_FILE = path.join(CONFIG_DIR, "history.json");

// 最大历史记录条数
const MAX_HISTORY = 500;

/**
 * 确保配置目录存在
 */
const ensureConfigDir = () => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

/**
 * 加载历史记录
 * @returns {string[]} 历史命令数组
 */
export const loadHistory = () => {
  try {
    ensureConfigDir();
    if (fs.existsSync(HISTORY_FILE)) {
      const data = fs.readFileSync(HISTORY_FILE, "utf-8");
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [];
    }
  } catch (error) {
    // 读取失败时返回空数组
    console.error("加载历史记录失败:", error.message);
  }
  return [];
};

/**
 * 保存历史记录
 * @param {string[]} history 历史命令数组
 */
export const saveHistory = (history) => {
  try {
    ensureConfigDir();
    // 只保留最近的 MAX_HISTORY 条记录
    const trimmed = history.slice(-MAX_HISTORY);
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  } catch (error) {
    console.error("保存历史记录失败:", error.message);
  }
};

/**
 * 添加一条历史记录
 * @param {string[]} history 当前历史数组
 * @param {string} command 新命令
 * @returns {string[]} 新的历史数组
 */
export const addToHistory = (history, command) => {
  // 避免重复添加相同命令
  if (history.length > 0 && history[history.length - 1] === command) {
    return history;
  }
  const newHistory = [...history, command];
  saveHistory(newHistory);
  return newHistory;
};
