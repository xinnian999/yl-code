import { EventEmitter } from "events";
import {
  ThinkingStatus,
  type MessagePort,
  type ThinkingStatusValue,
  type ThinkingState,
} from "./types.ts";

// ============ 消息类型 ============

export interface UserMessage {
  id: string;
  type: "user";
  content: string;
  timestamp: Date;
}

export interface AIMessage {
  id: string;
  type: "ai";
  blocks: string[];
  timestamp: Date;
}

export type Message = UserMessage | AIMessage;

// ============ 事件类型 ============

interface MessageBusEvents {
  message: (message: Message) => void;
  "message:update": (message: Message) => void;
  thinking: (status: ThinkingState) => void;
  clear: () => void;
}

// ============ 消息总线 ============

export class MessageBus extends EventEmitter implements MessagePort {
  private messages: Message[] = [];
  private thinkingStatus: ThinkingState = {
    status: ThinkingStatus.IDLE,
    detail: "",
  };
  private messageIdCounter = 0;

  private generateId(): string {
    this.messageIdCounter++;
    return `msg-${this.messageIdCounter}-${Date.now()}`;
  }

  private getLastAIMessage(): AIMessage | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === "ai") {
        return this.messages[i] as AIMessage;
      }
    }
    return null;
  }

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

  ai(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push(content);
    this.emit("message:update", msg);
  }

  tool(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push("🔨 " + content);
    this.emit("message:update", msg);
  }

  error(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push("❌ " + content);
    this.emit("message:update", msg);
  }

  warning(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push("⚠️  " + content);
    this.emit("message:update", msg);
  }

  setThinkingStatus(status: ThinkingStatusValue, detail: string = ""): void {
    this.thinkingStatus = { status, detail };
    this.emit("thinking", this.thinkingStatus);
  }

  getThinkingStatus(): ThinkingState {
    return { ...this.thinkingStatus };
  }

  getMessages(): Message[] {
    return [...this.messages];
  }

  clearMessages(): void {
    this.messages = [];
    this.emit("clear");
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
