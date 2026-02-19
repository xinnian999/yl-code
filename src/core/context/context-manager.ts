import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";

// ============ 常量 ============

/** 默认最大 token 数（128K 模型） */
export const DEFAULT_MAX_TOKENS = 128000;

/** 触发摘要的 token 阈值 */
export const SUMMARIZE_THRESHOLD = 20000;

/** 摘要提示词 */
const SUMMARIZE_PROMPT = `请将以下对话历史压缩为简洁的摘要，保留关键信息：
1. 用户的主要需求和意图
2. 已完成的操作和修改的文件
3. 重要的技术决策和上下文
4. 未完成的任务或待处理事项

请用中文输出摘要，尽量简洁但不遗漏关键信息。`;

// ============ Token 估算 ============

/** 每条消息的固定开销（role、分隔符等） */
const MESSAGE_OVERHEAD = 4;

/**
 * 估算文本的 token 数
 * CJK 字符按 1.5 token/字符，ASCII 按 0.25 token/字符（4字符≈1token）
 */
function estimateTextTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    tokens += char.charCodeAt(0) > 0x7f ? 1.5 : 0.25;
  }
  return Math.ceil(tokens);
}

/** 估算单条消息的 token 数（含 content + tool_calls 元数据） */
export function estimateMessageTokens(message: BaseMessage): number {
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);

  let tokens = estimateTextTokens(content) + MESSAGE_OVERHEAD;

  // AIMessage 的 tool_calls 元数据也会消耗 token
  const msgAny = message as any;
  if (msgAny.tool_calls?.length > 0) {
    const toolCallsJson = JSON.stringify(msgAny.tool_calls);
    tokens += estimateTextTokens(toolCallsJson);
  }

  return tokens;
}

/** 估算消息列表的总 token 数 */
export function estimateTotalTokens(messages: BaseMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }
  return total;
}

// ============ 消息分割 ============

/** 分割结果：保留部分 + 待摘要部分 */
export interface SplitResult {
  /** 始终保留的系统消息（index 0） */
  systemMessage: SystemMessage;
  /** 需要摘要的中间消息 */
  toSummarize: BaseMessage[];
  /** 保留的最近一轮对话（从最后一个 HumanMessage 起） */
  toKeep: BaseMessage[];
}

/**
 * 将消息列表分割为待摘要和保留两部分
 * 保留规则：SystemMessage（index 0）+ 最近一轮完整对话
 * 最近一轮 = 最后一个 HumanMessage 及其后的所有消息
 */
export function splitMessages(messages: BaseMessage[]): SplitResult | null {
  if (messages.length < 3) return null;

  const systemMessage = messages[0] as SystemMessage;

  // 找到最后一个 HumanMessage 的位置
  let lastHumanIndex = -1;
  for (let i = messages.length - 1; i >= 1; i--) {
    if (messages[i] instanceof HumanMessage) {
      lastHumanIndex = i;
      break;
    }
  }

  // 只有一轮对话或没有用户消息，不需要摘要
  if (lastHumanIndex <= 1) return null;

  const toSummarize = messages.slice(1, lastHumanIndex);
  const toKeep = messages.slice(lastHumanIndex);

  // 待摘要部分太短则跳过
  if (toSummarize.length < 2) return null;

  return { systemMessage, toSummarize, toKeep };
}

// ============ 摘要生成 ============

/** 获取消息角色标签 */
function getMessageRole(msg: BaseMessage): string {
  if (msg instanceof HumanMessage) return "用户";
  if (msg instanceof AIMessage) return "助手";
  if (msg instanceof ToolMessage) return "工具结果";
  if (msg instanceof SystemMessage) return "系统";
  return "未知";
}

/** 将消息列表格式化为可读文本，供 LLM 做摘要 */
function formatMessagesForSummary(messages: BaseMessage[]): string {
  return messages
    .map((msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      return `[${getMessageRole(msg)}]: ${content}`;
    })
    .join("\n\n");
}

/**
 * 调用 LLM 生成对话摘要
 * 使用不绑定工具的裸模型实例，避免工具调用开销
 */
export async function generateSummary(
  model: ChatOpenAI,
  messagesToSummarize: BaseMessage[]
): Promise<string> {
  const formatted = formatMessagesForSummary(messagesToSummarize);
  const response = await model.invoke([
    new HumanMessage(`${SUMMARIZE_PROMPT}\n\n---\n\n${formatted}`),
  ]);
  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}

/**
 * 将摘要文本构建为标准消息对（HumanMessage + AIMessage）
 * 维持消息交替规则，避免连续两个同类型消息
 */
export function buildSummaryMessages(
  summaryText: string
): [HumanMessage, AIMessage] {
  return [
    new HumanMessage(`[对话历史摘要]\n${summaryText}`),
    new AIMessage("好的，我已了解之前的对话内容，请继续。"),
  ];
}
