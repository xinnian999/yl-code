import { EventEmitter } from "events";

/**
 * 消息类型枚举（简化为两种）
 */
export const MessageType = {
  AI: "ai",
  USER: "user",
};

/**
 * AI 消息内容块类型枚举
 */
export const BlockType = {
  TEXT: "text",       // 普通文本输出，绿色
  TOOL: "tool",       // 工具调用，蓝色
  ERROR: "error",     // 错误提示，红色
  WARNING: "warning", // 警告提示，黄色
};

/**
 * 思考状态枚举
 */
export const ThinkingStatus = {
  IDLE: "idle",               // 空闲
  THINKING: "thinking",       // 思考中
  TOOL_CALLING: "tool_calling", // 正在调用工具
  WAITING: "waiting",         // 等待响应
};

/**
 * 消息总线类
 * 用于统一管理和分发所有消息
 */
class MessageBus extends EventEmitter {
  constructor() {
    super();
    this.messages = [];
    this.currentAIMessage = null; // 当前正在构建的 AI 消息
    this.thinkingStatus = {
      status: ThinkingStatus.IDLE,
      detail: "",
    };
  }

  /**
   * 生成消息 ID
   */
  _generateId() {
    this.messageIdCounter = (this.messageIdCounter || 0) + 1;
    return `msg-${this.messageIdCounter}-${Date.now()}`;
  }

  /**
   * 发送用户消息
   * @param {string} content - 消息内容
   */
  user(content) {
    const message = {
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
   * @returns {Object} 新创建的 AI 消息
   */
  createAIMessage() {
    const message = {
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
   * @param {string} blockType - 块类型（BlockType 枚举值）
   * @param {string} content - 块内容
   */
  appendBlock(blockType, content) {
    if (!this.currentAIMessage) {
      this.createAIMessage();
    }

    const block = {
      type: blockType,
      content,
    };

    this.currentAIMessage.blocks.push(block);
    this.emit("message:update", this.currentAIMessage);
    return block;
  }

  /**
   * 结束当前 AI 消息
   * 清除 currentAIMessage 引用
   */
  endAIMessage() {
    this.currentAIMessage = null;
  }

  /**
   * 快捷方法：添加 AI 文本输出
   */
  ai(content) {
    this.appendBlock(BlockType.TEXT, content);
  }

  /**
   * 快捷方法：添加工具调用信息
   */
  tool(content) {
    this.appendBlock(BlockType.TOOL, content);
  }

  /**
   * 快捷方法：添加错误信息
   */
  error(content) {
    this.appendBlock(BlockType.ERROR, content);
  }

  /**
   * 快捷方法：添加警告信息
   */
  warning(content) {
    this.appendBlock(BlockType.WARNING, content);
  }

  /**
   * 设置思考状态
   * @param {string} status - 状态（ThinkingStatus 枚举值）
   * @param {string} detail - 详细描述
   */
  setThinkingStatus(status, detail = "") {
    this.thinkingStatus = { status, detail };
    this.emit("thinking", this.thinkingStatus);
  }

  /**
   * 获取当前思考状态
   */
  getThinkingStatus() {
    return { ...this.thinkingStatus };
  }

  /**
   * 获取所有历史消息
   */
  getMessages() {
    return [...this.messages];
  }

  /**
   * 清空所有消息
   */
  clearMessages() {
    this.messages = [];
    this.currentAIMessage = null;
    this.emit("clear");
  }
}

// 导出单例
const messageBus = new MessageBus();
export default messageBus;
