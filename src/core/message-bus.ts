import { EventEmitter } from "events";
import {
  ThinkingStatus,
  type MessagePort,
  type ThinkingStatusValue,
  type ThinkingState,
} from "./types.ts";

// ============ 消息类型 ============

/** 用户消息 */
export interface UserMessage {
  id: string;
  type: "user";
  content: string;
  timestamp: Date;
}

/** AI 消息（包含多个内容块） */
export interface AIMessage {
  id: string;
  type: "ai";
  blocks: string[];
  timestamp: Date;
}

/** 消息联合类型 */
export type Message = UserMessage | AIMessage;

// ============ 事件类型 ============

/** 消息总线事件定义 */
interface MessageBusEvents {
  message: (message: Message) => void;
  "message:update": (message: Message) => void;
  thinking: (status: ThinkingState) => void;
  clear: () => void;
  restore: (messages: Message[]) => void;
}

// ============ 消息总线 ============

/**
 * 消息总线 - 管理消息列表、思考状态和事件通知
 */
export class MessageBus extends EventEmitter implements MessagePort {
  /** 消息列表 */
  private messages: Message[] = [];
  /** 当前思考状态 */
  private thinkingStatus: ThinkingState = {
    status: ThinkingStatus.IDLE,
    detail: "",
  };
  /** 消息 ID 计数器 */
  private messageIdCounter = 0;

  /** 生成唯一消息 ID */
  private generateId(): string {
    this.messageIdCounter++;
    return `msg-${this.messageIdCounter}-${Date.now()}`;
  }

  /** 获取最后一条 AI 消息 */
  private getLastAIMessage(): AIMessage | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === "ai") {
        return this.messages[i] as AIMessage;
      }
    }
    return null;
  }

  /** 添加用户消息 */
  user(content: string): UserMessage {
    const message: UserMessage = {
      id: this.generateId(),
      type: "user",
      content,
      timestamp: new Date(),
    };
    this.messages.push(message);
    this.emit("message", message);
    return message;
  }

  /** 创建新的 AI 消息 */
  createAIMessage(): AIMessage {
    const message: AIMessage = {
      id: this.generateId(),
      type: "ai",
      blocks: [],
      timestamp: new Date(),
    };
    this.messages.push(message);
    this.emit("message", message);
    return message;
  }

  /** 追加 AI 文本内容块 */
  ai(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push(content);
    this.emit("message:update", msg);
  }

  /** 追加工具调用内容块 */
  tool(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push("🔨 " + content);
    this.emit("message:update", msg);
  }

  /** 追加错误内容块 */
  error(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push("❌ " + content);
    this.emit("message:update", msg);
  }

  /** 追加警告内容块 */
  warning(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push("⚠️  " + content);
    this.emit("message:update", msg);
  }

  /** 设置思考状态 */
  setThinkingStatus(status: ThinkingStatusValue, detail: string = ""): void {
    this.thinkingStatus = { status, detail };
    this.emit("thinking", this.thinkingStatus);
  }

  /** 获取当前思考状态 */
  getThinkingStatus(): ThinkingState {
    return { ...this.thinkingStatus };
  }

  /** 获取所有消息的副本 */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /** 清空所有消息 */
  clearMessages(): void {
    this.messages = [];
    this.emit("clear");
  }

  /** 恢复消息列表（用于会话切换） */
  restoreMessages(messages: Message[]): void {
    this.messages = [...messages];
    this.messageIdCounter = messages.length;
    this.emit("restore", this.messages);
  }

  // 类型安全的事件方法
  on<K extends keyof MessageBusEvents>(event: K, listener: MessageBusEvents[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof MessageBusEvents>(event: K, listener: MessageBusEvents[K]): this {
    return super.off(event, listener);
  }

  emit<K extends keyof MessageBusEvents>(event: K, ...args: Parameters<MessageBusEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
