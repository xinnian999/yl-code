import messageBus, { ThinkingStatus } from "./message-bus.js";

/**
 * 创建新的 AI 消息并添加文本内容
 * @param {string} content - 文本内容
 */
const ai = (content) => {
  messageBus.createAIMessage();
  messageBus.ai(content);
};

/**
 * 向当前 AI 消息追加文本内容（不创建新消息）
 * @param {string} content - 文本内容
 */
const text = (content) => {
  messageBus.ai(content);
};

/**
 * 向当前 AI 消息追加工具调用信息
 * @param {string} content - 工具信息
 */
const tool = (content) => {
  messageBus.tool(content);
};

/**
 * 向当前 AI 消息追加错误信息
 * @param {string} content - 错误信息
 */
const error = (content) => {
  messageBus.error(content);
};

/**
 * 向当前 AI 消息追加警告信息
 * @param {string} content - 警告信息
 */
const warning = (content) => {
  messageBus.warning(content);
};

/**
 * 设置思考状态
 * @param {string} status - 状态值（ThinkingStatus 枚举）
 * @param {string} detail - 详细描述
 */
const setThinking = (status, detail = "") => {
  messageBus.setThinkingStatus(status, detail);
};

/**
 * 结束当前 AI 消息
 */
const endAIMessage = () => {
  messageBus.endAIMessage();
};

/**
 * 创建新的 AI 消息（不添加内容）
 */
const createAIMessage = () => {
  messageBus.createAIMessage();
};

export default {
  ai,
  text,
  tool,
  error,
  warning,
  setThinking,
  endAIMessage,
  createAIMessage,
  // 导出状态枚举便于使用
  ThinkingStatus,
};
