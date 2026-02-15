import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { StoredMessage } from "@langchain/core/messages";
import type { Message, UserMessage, AIMessage } from "./message-bus.ts";

// ============ 常量 ============

/** 会话存储目录 */
const SESSIONS_DIR = join(homedir(), ".niu-code", "sessions");
/** 索引文件路径 */
const INDEX_FILE = join(SESSIONS_DIR, "index.json");
/** 最大会话数量 */
const MAX_SESSIONS = 50;
/** 标题最大长度 */
const MAX_TITLE_LENGTH = 30;

// ============ 类型定义 ============

/** 会话元数据 */
export interface SessionMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/** 会话索引（持久化到 index.json） */
export interface SessionIndex {
  sessions: SessionMeta[];
}

/** UI 消息的可序列化形式（timestamp 为 ISO 字符串） */
export type SerializedUIMessage =
  | { id: string; type: "user"; content: string; timestamp: string }
  | { id: string; type: "ai"; blocks: string[]; timestamp: string };

/** 单个会话完整数据（持久化到 session_xxx.json） */
export interface SessionData {
  meta: SessionMeta;
  chatMessages: StoredMessage[];
  uiMessages: SerializedUIMessage[];
}

// ============ 目录管理 ============

/** 确保会话存储目录存在 */
export function ensureSessionsDir(): void {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

// ============ 索引操作 ============

/** 加载会话索引 */
export function loadSessionIndex(): SessionIndex {
  try {
    ensureSessionsDir();
    if (existsSync(INDEX_FILE)) {
      const data = readFileSync(INDEX_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && Array.isArray(parsed.sessions)) {
        return parsed as SessionIndex;
      }
    }
  } catch {
    // 读取失败返回空索引
  }
  return { sessions: [] };
}

/** 保存会话索引（超出上限时删除最旧会话） */
export function saveSessionIndex(index: SessionIndex): void {
  ensureSessionsDir();
  // 按 updatedAt 降序排列
  index.sessions.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  // 超出上限时删除最旧的会话文件
  while (index.sessions.length > MAX_SESSIONS) {
    const removed = index.sessions.pop();
    if (removed) {
      deleteSessionFile(removed.id);
    }
  }
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), "utf-8");
}

// ============ 会话数据操作 ============

/** 获取会话文件路径 */
function getSessionFilePath(sessionId: string): string {
  return join(SESSIONS_DIR, `${sessionId}.json`);
}

/** 加载单个会话数据 */
export function loadSessionData(sessionId: string): SessionData | null {
  try {
    const filePath = getSessionFilePath(sessionId);
    if (existsSync(filePath)) {
      const data = readFileSync(filePath, "utf-8");
      return JSON.parse(data) as SessionData;
    }
  } catch {
    // 读取失败返回 null
  }
  return null;
}

/** 保存单个会话数据 */
export function saveSessionData(data: SessionData): void {
  ensureSessionsDir();
  const filePath = getSessionFilePath(data.meta.id);
  writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

/** 删除会话文件 */
export function deleteSessionFile(sessionId: string): void {
  try {
    const filePath = getSessionFilePath(sessionId);
    if (existsSync(filePath)) {
      unlinkSync(filePath);
    }
  } catch {
    // 删除失败静默处理
  }
}

// ============ 工具函数 ============

/** 生成会话唯一 ID */
export function generateSessionId(): string {
  return `session_${Date.now()}`;
}

/** 从第一条用户消息生成会话标题 */
export function generateTitle(firstUserMessage: string): string {
  if (!firstUserMessage) return "新对话";
  const cleaned = firstUserMessage.replace(/\n/g, " ").trim();
  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned;
  return cleaned.slice(0, MAX_TITLE_LENGTH) + "...";
}

/** 将 UI 消息列表序列化为可持久化格式 */
export function serializeUIMessages(messages: Message[]): SerializedUIMessage[] {
  return messages.map((msg) => {
    if (msg.type === "user") {
      const userMsg = msg as UserMessage;
      return { id: userMsg.id, type: "user" as const, content: userMsg.content, timestamp: userMsg.timestamp.toISOString() };
    }
    const aiMsg = msg as AIMessage;
    return { id: aiMsg.id, type: "ai" as const, blocks: [...aiMsg.blocks], timestamp: aiMsg.timestamp.toISOString() };
  });
}

/** 将序列化消息还原为 UI 消息格式 */
export function deserializeUIMessages(messages: SerializedUIMessage[]): Message[] {
  return messages.map((msg) => {
    if (msg.type === "user") {
      return { id: msg.id, type: "user" as const, content: msg.content, timestamp: new Date(msg.timestamp) };
    }
    return { id: msg.id, type: "ai" as const, blocks: [...msg.blocks], timestamp: new Date(msg.timestamp) };
  });
}
