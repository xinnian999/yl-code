import { EventEmitter } from "events";
import {
  mapChatMessagesToStoredMessages,
  mapStoredMessagesToChatMessages,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { Message } from "./message-bus.ts";
import {
  type SessionMeta,
  type SessionIndex,
  loadSessionIndex,
  saveSessionIndex,
  loadSessionData,
  saveSessionData,
  deleteSessionFile,
  generateSessionId,
  generateTitle,
  serializeUIMessages,
  deserializeUIMessages,
} from "./session-store.ts";

// ============ 事件类型 ============

/** 会话管理器事件定义 */
interface SessionManagerEvents {
  "session:change": (sessionId: string) => void;
  "session:saved": (meta: SessionMeta) => void;
}

// ============ 会话管理器 ============

/**
 * 会话管理器 - 管理对话会话的创建、保存、切换和删除
 * 参照 ConfigManager 模式，使用 EventEmitter + 文件持久化
 */
export class SessionManager extends EventEmitter {
  /** 当前会话 ID */
  private currentSessionId: string;
  /** 会话索引（内存缓存） */
  private index: SessionIndex;

  constructor() {
    super();
    this.index = loadSessionIndex();
    this.currentSessionId = generateSessionId();
  }

  /** 获取当前会话 ID */
  getCurrentSessionId(): string {
    return this.currentSessionId;
  }

  /** 获取所有会话元数据列表（按更新时间降序） */
  getSessions(): SessionMeta[] {
    return [...this.index.sessions];
  }

  /**
   * 保存当前会话到磁盘
   * 空会话（无用户消息）不保存
   */
  saveCurrentSession(
    chatMessages: BaseMessage[],
    uiMessages: Message[],
    firstUserMessage: string
  ): void {
    // 没有用户消息则跳过保存
    if (!firstUserMessage) return;

    const now = new Date().toISOString();
    const existingMeta = this.index.sessions.find(
      (s) => s.id === this.currentSessionId
    );

    const meta: SessionMeta = {
      id: this.currentSessionId,
      title: existingMeta?.title || generateTitle(firstUserMessage),
      createdAt: existingMeta?.createdAt || now,
      updatedAt: now,
      messageCount: uiMessages.length,
    };

    // 序列化并保存会话数据
    const data = {
      meta,
      chatMessages: mapChatMessagesToStoredMessages(chatMessages),
      uiMessages: serializeUIMessages(uiMessages),
    };
    saveSessionData(data);

    // 更新索引
    const existingIndex = this.index.sessions.findIndex(
      (s) => s.id === this.currentSessionId
    );
    if (existingIndex >= 0) {
      this.index.sessions[existingIndex] = meta;
    } else {
      this.index.sessions.push(meta);
    }
    saveSessionIndex(this.index);

    this.emit("session:saved", meta);
  }

  /**
   * 加载指定会话数据
   * 返回反序列化后的 chatMessages 和 uiMessages
   */
  loadSession(
    sessionId: string
  ): { chatMessages: BaseMessage[]; uiMessages: Message[] } | null {
    const data = loadSessionData(sessionId);
    if (!data) return null;

    return {
      chatMessages: mapStoredMessagesToChatMessages(data.chatMessages),
      uiMessages: deserializeUIMessages(data.uiMessages),
    };
  }

  /** 开始新会话，返回新会话 ID */
  startNewSession(): string {
    this.currentSessionId = generateSessionId();
    this.emit("session:change", this.currentSessionId);
    return this.currentSessionId;
  }

  /** 切换到指定会话 */
  switchToSession(
    sessionId: string
  ): { chatMessages: BaseMessage[]; uiMessages: Message[] } | null {
    const data = this.loadSession(sessionId);
    if (!data) return null;

    this.currentSessionId = sessionId;
    this.emit("session:change", sessionId);
    return data;
  }

  /** 删除指定会话 */
  deleteSession(sessionId: string): void {
    // 不能删除当前会话
    if (sessionId === this.currentSessionId) return;

    deleteSessionFile(sessionId);
    this.index.sessions = this.index.sessions.filter(
      (s) => s.id !== sessionId
    );
    saveSessionIndex(this.index);
  }

  // ============ 类型安全的事件方法 ============

  on<K extends keyof SessionManagerEvents>(
    event: K,
    listener: SessionManagerEvents[K]
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof SessionManagerEvents>(
    event: K,
    listener: SessionManagerEvents[K]
  ): this {
    return super.off(event, listener);
  }

  emit<K extends keyof SessionManagerEvents>(
    event: K,
    ...args: Parameters<SessionManagerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
