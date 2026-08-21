import { describe, expect, test } from "vitest";
import {
  AIMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { splitMessages } from "./message-splitter.ts";

describe("message-splitter", () => {
  test("会保留最后一条用户消息和最近窗口", () => {
    const longText = "这是一段用于触发摘要阈值的上下文内容。".repeat(40);
    const messages = [
      new SystemMessage("system"),
      new HumanMessage(`用户问题 1 ${longText}`),
      new AIMessage(`助手回答 1 ${longText}`),
      new HumanMessage(`用户问题 2 ${longText}`),
      new AIMessage(`助手回答 2 ${longText}`),
      new HumanMessage(`用户问题 3 ${longText}`),
      new AIMessage(`助手回答 3 ${longText}`),
      new HumanMessage(`用户问题 4 ${longText}`),
      new AIMessage(`助手回答 4 ${longText}`),
      new HumanMessage(`用户问题 5 ${longText}`),
      new AIMessage(`助手回答 5 ${longText}`),
      new HumanMessage(`用户问题 6 ${longText}`),
      new AIMessage(`助手回答 6 ${longText}`),
      new HumanMessage(`用户问题 7 ${longText}`),
      new AIMessage(`助手回答 7 ${longText}`),
      new HumanMessage(`用户问题 8 ${longText}`),
      new AIMessage(`助手回答 8 ${longText}`),
      new HumanMessage(`用户问题 9 ${longText}`),
      new AIMessage(`助手回答 9 ${longText}`),
      new HumanMessage(`用户问题 10 ${longText}`),
      new AIMessage(`助手回答 10 ${longText}`),
      new HumanMessage("最后一个用户问题"),
      new AIMessage("最后一个回答"),
    ];

    const result = splitMessages(messages);

    expect(result).not.toBeNull();
    expect(result?.toKeep.some((message) => {
      return message instanceof HumanMessage && message.content === "最后一个用户问题";
    })).toBe(true);
    expect(result?.toSummarize.length).toBeGreaterThan(0);
  });
});
