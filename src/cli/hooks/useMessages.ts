import { useState, useEffect } from "react";
import { ThinkingStatus, type ThinkingState } from "@/core/types.ts";
import type { Message } from "@/core/message-bus.ts";
import type { Agent } from "@/core/agent.ts";

export type { Message } from "@/core/message-bus.ts";

/**
 * 消息状态管理 hook
 * 订阅 agent 消息事件，管理消息列表和思考状态
 */
export function useMessages(agent: Agent) {
  const [messages, setMessages] = useState<Message[]>(() => agent.messageBus.getMessages());
  const [thinkingStatus, setThinkingStatus] = useState<ThinkingState>({
    status: ThinkingStatus.IDLE,
    detail: "",
  });

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

    const handleClear = () => {
      setMessages([]);
    };

    const { messageBus } = agent;
    messageBus.on("message", handleMessage);
    messageBus.on("message:update", handleMessageUpdate);
    messageBus.on("thinking", handleThinking);
    messageBus.on("clear", handleClear);

    return () => {
      messageBus.off("message", handleMessage);
      messageBus.off("message:update", handleMessageUpdate);
      messageBus.off("thinking", handleThinking);
      messageBus.off("clear", handleClear);
    };
  }, [agent]);

  return { messages, thinkingStatus };
}
