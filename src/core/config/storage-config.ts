import { homedir } from "os";
import { join } from "path";

/** 全局配置目录 */
export const NIUMA_CONFIG_DIR = join(homedir(), ".niuma");

/** 主配置文件路径 */
export const APP_CONFIG_FILE = join(NIUMA_CONFIG_DIR, "config.json");

/** MCP 配置文件路径 */
export const MCP_CONFIG_FILE = join(NIUMA_CONFIG_DIR, "mcp.json");

/** 历史记录文件路径 */
export const HISTORY_FILE = join(NIUMA_CONFIG_DIR, "history.json");

/** 会话目录路径 */
export const SESSIONS_DIR = join(NIUMA_CONFIG_DIR, "sessions");

/** 会话索引文件路径 */
export const SESSION_INDEX_FILE = join(SESSIONS_DIR, "index.json");

/** 最大历史记录数 */
export const MAX_HISTORY = 500;

/** 最大会话数 */
export const MAX_SESSIONS = 50;

/** 会话标题最大长度 */
export const MAX_SESSION_TITLE_LENGTH = 30;
