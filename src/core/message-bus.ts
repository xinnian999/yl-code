import { EventEmitter } from "events";
import {
  ThinkingStatus,
  type MessagePort,
  type ThinkingStatusValue,
  type ThinkingState,
  type TodoItem,
  type MessageBlock,
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
  blocks: MessageBlock[];
  timestamp: Date;
  totalDurationMs?: number;
}

/** 消息联合类型 */
export type Message = UserMessage | AIMessage;

// ============ 事件类型 ============

/** 消息总线事件定义 */
interface MessageBusEvents {
  message: (message: Message) => void;
  "message:update": (message: Message) => void;
  thinking: (status: ThinkingState) => void;
  /** 流式输出状态变更（blockIndex = -1 表示无流式输出） */
  streaming: (blockIndex: number) => void;
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
  /** 当前流式输出的块索引（-1 表示无流式输出） */
  private _streamingBlockIndex: number = -1;

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
    msg.blocks.push({ type: "text", content });
    this.emit("message:update", msg);
  }

  /** 创建一个文本块并返回块索引（用于后续流式追加） */
  createTextBlock(content: string = ""): number {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push({ type: "text", content });
    this.emit("message:update", msg);
    return msg.blocks.length - 1;
  }

  /** 向指定文本块追加内容（用于流式输出） */
  appendToBlock(blockIndex: number, content: string): void {
    const msg = this.getLastAIMessage();
    if (!msg || blockIndex >= msg.blocks.length) return;
    const block = msg.blocks[blockIndex];
    if (block.type === "text") {
      block.content += content;
    }
    this.emit("message:update", msg);
  }

  /** 追加 todo 快照块 */
  todoSnapshot(todos: TodoItem[]): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push({ type: "todo", todos: todos.map((t) => ({ ...t })) });
    this.emit("message:update", msg);
  }

  /** 追加工具调用内容块 */
  tool(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push({ type: "tool", content });
    this.emit("message:update", msg);
  }

  /** 追加错误内容块 */
  error(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push({ type: "error", content });
    this.emit("message:update", msg);
  }

  /** 追加警告内容块 */
  warning(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) msg = this.createAIMessage();
    msg.blocks.push({ type: "warning", content });
    this.emit("message:update", msg);
  }

  setLastAITotalDuration(totalDurationMs: number): void {
    const msg = this.getLastAIMessage();
    if (!msg) return;
    msg.totalDurationMs = totalDurationMs;
    this.emit("message:update", msg);
  }

  /** 向最后一个 block 追加调试信息（多次调用会换行拼接） */
  appendDebugToLastBlock(info: string): void {
    const msg = this.getLastAIMessage();
    if (!msg || msg.blocks.length === 0) return;
    const lastIndex = msg.blocks.length - 1;
    const last = msg.blocks[lastIndex];
    msg.blocks[lastIndex] = { ...last, debug: last.debug ? last.debug + "\n" + info : info };
    this.emit("message:update", msg);
  }

  /** 按索引设置指定 block 的调试信息（全量替换） */
  setDebugOnBlock(blockIndex: number, debug: string): void {
    const msg = this.getLastAIMessage();
    if (!msg || blockIndex >= msg.blocks.length) return;
    msg.blocks[blockIndex] = { ...msg.blocks[blockIndex], debug };
    this.emit("message:update", msg);
  }

  /** 设置当前流式输出的块索引 */
  setStreamingBlock(blockIndex: number): void {
    this._streamingBlockIndex = blockIndex;
    this.emit("streaming", blockIndex);
  }

  /** 清除流式输出状态 */
  clearStreamingBlock(): void {
    this._streamingBlockIndex = -1;
    this.emit("streaming", -1);
  }

  /** 获取当前流式输出的块索引（-1 表示无流式输出） */
  getStreamingBlockIndex(): number {
    return this._streamingBlockIndex;
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
