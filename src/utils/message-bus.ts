import { EventEmitter } from "events";

/**
 * 消息类型枚举
 */
export const MessageType = {
  AI: "ai",
  USER: "user",
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

/**
 * AI 消息内容块类型枚举
 */
export const BlockType = {
  TEXT: "text",       // 普通文本输出，绿色
  TOOL: "tool",       // 工具调用，蓝色
  ERROR: "error",     // 错误提示，红色
  WARNING: "warning", // 警告提示，黄色
} as const;

export type BlockTypeValue = (typeof BlockType)[keyof typeof BlockType];

/**
 * 思考状态枚举
 */
export const ThinkingStatus = {
  IDLE: "idle",               // 空闲
  THINKING: "thinking",       // 思考中
  TOOL_CALLING: "tool_calling", // 正在调用工具
  WAITING: "waiting",         // 等待响应
} as const;

export type ThinkingStatusValue = (typeof ThinkingStatus)[keyof typeof ThinkingStatus];

/**
 * 内容块类型
 */
export interface Block {
  type: BlockTypeValue;
  content: string;
}

/**
 * 用户消息类型
 */
export interface UserMessage {
  id: string;
  type: typeof MessageType.USER;
  content: string;
  timestamp: Date;
}

/**
 * AI 消息类型
 */
export interface AIMessage {
  id: string;
  type: typeof MessageType.AI;
  blocks: Block[];
  timestamp: Date;
}

/**
 * 消息联合类型
 */
export type Message = UserMessage | AIMessage;

/**
 * 思考状态类型
 */
export interface ThinkingState {
  status: ThinkingStatusValue;
  detail: string;
}

/**
 * 消息总线事件类型
 */
interface MessageBusEvents {
  message: (message: Message) => void;
  "message:update": (message: Message) => void;
  thinking: (status: ThinkingState) => void;
  clear: () => void;
}

/**
 * 消息总线类
 * 用于统一管理和分发所有消息
 */
class MessageBus extends EventEmitter {
  private messages: Message[] = [];
  private currentAIMessage: AIMessage | null = null;
  private thinkingStatus: ThinkingState = {
    status: ThinkingStatus.IDLE,
    detail: "",
  };
  private messageIdCounter: number = 0;

  constructor() {
    super();
  }

  /**
   * 生成消息 ID
   */
  private _generateId(): string {
    this.messageIdCounter++;
    return `msg-${this.messageIdCounter}-${Date.now()}`;
  }

  /**
   * 发送用户消息
   */
  user(content: string): UserMessage {
    const message: UserMessage = {
      id: this._generateId(),
      type: MessageType.USER,
      content,
      timestamp: new Date(),
    };

    this.messages.push(message);
    this.emit("message", message);
    return message;
  }

  /**
   * 创建新的 AI 消息
   */
  createAIMessage(): AIMessage {
    const message: AIMessage = {
      id: this._generateId(),
      type: MessageType.AI,
      blocks: [],
      timestamp: new Date(),
    };

    this.messages.push(message);
    this.currentAIMessage = message;
    this.emit("message", message);
    return message;
  }

  /**
   * 向当前 AI 消息追加内容块
   * 如果没有当前 AI 消息，会自动创建一个
   */
  appendBlock(blockType: BlockTypeValue, content: string): Block {
    if (!this.currentAIMessage) {
      this.createAIMessage();
    }

    const block: Block = {
      type: blockType,
      content,
    };

    this.currentAIMessage!.blocks.push(block);
    this.emit("message:update", this.currentAIMessage!);
    return block;
  }

  /**
   * 结束当前 AI 消息
   * 清除 currentAIMessage 引用
   */
  endAIMessage(): void {
    this.currentAIMessage = null;
  }

  /**
   * 快捷方法：添加 AI 文本输出
   */
  ai(content: string): void {
    this.appendBlock(BlockType.TEXT, content + '\n');
  }

  /**
   * 快捷方法：添加工具调用信息
   */
  tool(content: string): void {
    this.appendBlock(BlockType.TOOL, content + '\n');
  }

  /**
   * 快捷方法：添加错误信息
   */
  error(content: string): void {
    this.appendBlock(BlockType.ERROR, content);
  }

  /**
   * 快捷方法：添加警告信息
   */
  warning(content: string): void {
    this.appendBlock(BlockType.WARNING, content);
  }

  /**
   * 设置思考状态
   */
  setThinkingStatus(status: ThinkingStatusValue, detail: string = ""): void {
    this.thinkingStatus = { status, detail };
    this.emit("thinking", this.thinkingStatus);
  }

  /**
   * 获取当前思考状态
   */
  getThinkingStatus(): ThinkingState {
    return { ...this.thinkingStatus };
  }

  /**
   * 获取所有历史消息
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * 清空所有消息
   */
  clearMessages(): void {
    this.messages = [];
    this.currentAIMessage = null;
    this.emit("clear");
  }

  // 类型安全的事件监听方法
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

// 导出单例
const messageBus = new MessageBus();
export default messageBus;
