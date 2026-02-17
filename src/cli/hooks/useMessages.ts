import { useState, useEffect } from "react";
import { ThinkingStatus, type ThinkingState } from "@/core/types.ts";
import type { Message } from "@/core/message-bus.ts";
import type { Agent } from "@/core/agent.ts";

export type { Message } from "@/core/message-bus.ts";

/**
 * 消息状态管理 hook
 * 订阅 agent 消息事件，管理消息列表、思考状态和流式输出状态
 */
export function useMessages(agent: Agent) {
  const [messages, setMessages] = useState<Message[]>(() => agent.messageBus.getMessages());
  const [thinkingStatus, setThinkingStatus] = useState<ThinkingState>({
    status: ThinkingStatus.IDLE,
    detail: "",
  });
  /** 当前流式输出的块索引（-1 表示无流式输出） */
  const [streamingBlockIndex, setStreamingBlockIndex] = useState<number>(
    () => agent.messageBus.getStreamingBlockIndex()
  );

  useEffect(() => {
    const handleMessage = (message: Message) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleMessageUpdate = (updatedMessage: Message) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === updatedMessage.id ? { ...updatedMessage } : msg
        )
      );
    };

    const handleThinking = (status: ThinkingState) => {
      setThinkingStatus(status);
    };

    const handleStreaming = (blockIndex: number) => {
      setStreamingBlockIndex(blockIndex);
    };

    const handleClear = () => {
      setMessages([]);
    };

    const handleRestore = (restoredMessages: Message[]) => {
      setMessages([...restoredMessages]);
    };

    const { messageBus } = agent;
    messageBus.on("message", handleMessage);
    messageBus.on("message:update", handleMessageUpdate);
    messageBus.on("thinking", handleThinking);
    messageBus.on("streaming", handleStreaming);
    messageBus.on("clear", handleClear);
    messageBus.on("restore", handleRestore);

    return () => {
      messageBus.off("message", handleMessage);
      messageBus.off("message:update", handleMessageUpdate);
      messageBus.off("thinking", handleThinking);
      messageBus.off("streaming", handleStreaming);
      messageBus.off("clear", handleClear);
      messageBus.off("restore", handleRestore);
    };
  }, [agent]);

  return { messages, thinkingStatus, streamingBlockIndex };
}
