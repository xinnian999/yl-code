import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import { SUMMARIZE_PROMPT } from "../config/context-config.ts";

/** 获取消息的中文角色标签 */
function getMessageRole(message: BaseMessage): string {
  if (message instanceof HumanMessage) {
    return "用户";
  }
  if (message instanceof AIMessage) {
    return "助手";
  }
  if (message instanceof ToolMessage) {
    return "工具结果";
  }
  if (message instanceof SystemMessage) {
    return "系统";
  }
  return "未知";
}

/** 将消息列表格式化为摘要模型可读文本 */
function formatMessagesForSummary(messages: BaseMessage[]): string {
  return messages
    .map((message) => {
      const content =
        typeof message.content === "string"
          ? message.content
          : JSON.stringify(message.content);
      return `[${getMessageRole(message)}]: ${content}`;
    })
    .join("\n\n");
}

/**
 * 调用裸模型生成对话摘要。
 * 这里不绑定工具，避免额外的工具调用开销。
 */
export async function generateSummary(
  model: ChatOpenAI,
  messagesToSummarize: BaseMessage[]
): Promise<string> {
  const formattedMessages = formatMessagesForSummary(messagesToSummarize);
  const response = await model.invoke([
    new HumanMessage(`${SUMMARIZE_PROMPT}\n\n---\n\n${formattedMessages}`),
  ]);

  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}

/** 将摘要文本构建为标准消息对，维持消息交替结构 */
export function buildSummaryMessages(
  summaryText: string
): [HumanMessage, AIMessage] {
  return [
    new HumanMessage(`[对话历史摘要]\n${summaryText}`),
    new AIMessage("好的，我已了解之前的对话内容，请继续。"),
  ];
}
