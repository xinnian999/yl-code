import type { BaseMessage } from "@langchain/core/messages";

/** 每条消息的固定 token 开销（role、分隔符等） */
const MESSAGE_OVERHEAD = 4;

/**
 * 估算文本的 token 数。
 * CJK 字符按 1.5 token/字符，ASCII 按 0.25 token/字符估算。
 */
export function estimateTextTokens(text: string): number {
  let tokens = 0;

  for (const char of text) {
    tokens += char.charCodeAt(0) > 0x7f ? 1.5 : 0.25;
  }

  return Math.ceil(tokens);
}

/** 估算单条消息的 token 数（含 content 与 tool_calls 元数据） */
export function estimateMessageTokens(message: BaseMessage): number {
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);
  let tokens = estimateTextTokens(content) + MESSAGE_OVERHEAD;

  const messageWithToolCalls = message as BaseMessage & {
    tool_calls?: unknown[];
  };
  if (messageWithToolCalls.tool_calls?.length) {
    tokens += estimateTextTokens(JSON.stringify(messageWithToolCalls.tool_calls));
  }

  return tokens;
}

/** 估算消息列表的总 token 数 */
export function estimateTotalTokens(messages: BaseMessage[]): number {
  let total = 0;
  for (const message of messages) {
    total += estimateMessageTokens(message);
  }
  return total;
}
