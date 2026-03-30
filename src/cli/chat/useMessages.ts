import { useEffect, useState } from "react";
import { ThinkingStatus, type ThinkingState } from "@/core/types.ts";
import type { AIMessage, Message } from "@/core/message-bus.ts";
import type { Agent } from "@/core/agent/Agent.ts";

/** 深拷贝消息，确保 AI 消息的 blocks 数组和每个 block 对象都是新引用 */
function cloneMessage(message: Message): Message {
  if (message.type === "ai") {
    const aiMessage = message as AIMessage;
    return {
      ...aiMessage,
      blocks: aiMessage.blocks.map((block) => ({ ...block })),
    };
  }

  return { ...message };
}

/** 消息状态订阅结果 */
export interface UseMessagesResult {
  /** 当前消息列表 */
  messages: Message[];
  /** 当前思考状态 */
  thinkingStatus: ThinkingState;
  /** 当前流式块索引 */
  streamingBlockIndex: number;
}

/** 消息状态管理 hook */
export function useMessages(agent: Agent): UseMessagesResult {
  const [messages, setMessages] = useState<Message[]>(() => {
    return agent.messageBus.getMessages();
  });
  const [thinkingStatus, setThinkingStatus] = useState<ThinkingState>(() => {
    return agent.messageBus.getThinkingStatus?.() || {
      status: ThinkingStatus.IDLE,
      detail: "",
    };
  });
  const [streamingBlockIndex, setStreamingBlockIndex] = useState<number>(() => {
    return agent.messageBus.getStreamingBlockIndex();
  });

  useEffect(() => {
    /** 处理新消息 */
    const handleMessage = (message: Message) => {
      setMessages((currentMessages) => [...currentMessages, message]);
    };

    /** 处理消息更新 */
    const handleMessageUpdate = (updatedMessage: Message) => {
      setMessages((currentMessages) => {
        return currentMessages.map((message) => {
          return message.id === updatedMessage.id
            ? cloneMessage(updatedMessage)
            : message;
        });
      });
    };

    /** 处理思考状态 */
    const handleThinking = (status: ThinkingState) => {
      setThinkingStatus(status);
    };

    /** 处理流式块索引变化 */
    const handleStreaming = (blockIndex: number) => {
      setStreamingBlockIndex(blockIndex);
    };

    /** 清空消息 */
    const handleClear = () => {
      setMessages([]);
    };

    /** 恢复消息 */
    const handleRestore = (restoredMessages: Message[]) => {
      setMessages([...restoredMessages]);
    };

    agent.messageBus.on("message", handleMessage);
    agent.messageBus.on("message:update", handleMessageUpdate);
    agent.messageBus.on("thinking", handleThinking);
    agent.messageBus.on("streaming", handleStreaming);
    agent.messageBus.on("clear", handleClear);
    agent.messageBus.on("restore", handleRestore);

    return () => {
      agent.messageBus.off("message", handleMessage);
      agent.messageBus.off("message:update", handleMessageUpdate);
      agent.messageBus.off("thinking", handleThinking);
      agent.messageBus.off("streaming", handleStreaming);
      agent.messageBus.off("clear", handleClear);
      agent.messageBus.off("restore", handleRestore);
    };
  }, [agent]);

  return { messages, thinkingStatus, streamingBlockIndex };
}
