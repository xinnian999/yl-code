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
  blocks: string[];
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
   * 获取最后一条 AI 消息
   */
  private getLastAIMessage(): AIMessage | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].type === MessageType.AI) {
        return this.messages[i] as AIMessage;
      }
    }
    return null;
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
    this.emit("message", message);
    return message;
  }

  /**
   * 快捷方法：添加 AI 文本输出
   */
  ai(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) {
      msg = this.createAIMessage();
    }
    msg.blocks.push(content);
    this.emit("message:update", msg);
  }

  /**
   * 快捷方法：添加工具调用信息
   */
  tool(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) {
      msg = this.createAIMessage();
    }
    msg.blocks.push('🔨 ' + content);
    this.emit("message:update", msg);
  }

  /**
   * 快捷方法：添加错误信息
   */
  error(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) {
      msg = this.createAIMessage();
    }
    msg.blocks.push('❌ ' + content);
    this.emit("message:update", msg);
  }

  /**
   * 快捷方法：添加警告信息
   */
  warning(content: string): void {
    let msg = this.getLastAIMessage();
    if (!msg) {
      msg = this.createAIMessage();
    }
    msg.blocks.push('⚠️  ' + content);
    this.emit("message:update", msg);
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
