import { useState, useEffect } from "react";
import { ThinkingStatus, type ThinkingState } from "@/core/types.ts";
import type { MessageBus, Message } from "@/core/message-bus.ts";

export type { Message } from "@/core/message-bus.ts";

/**
 * 消息状态管理 hook
 * 订阅 messageBus 事件，管理消息列表和思考状态
 */
export function useMessages(messageBus: MessageBus, welcomeMessage?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
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

    messageBus.on("message", handleMessage);
    messageBus.on("message:update", handleMessageUpdate);
    messageBus.on("thinking", handleThinking);
    messageBus.on("clear", handleClear);

    // 监听器注册完成后再发送欢迎消息
    if (welcomeMessage) {
      messageBus.ai(welcomeMessage);
    }

    return () => {
      messageBus.off("message", handleMessage);
      messageBus.off("message:update", handleMessageUpdate);
      messageBus.off("thinking", handleThinking);
      messageBus.off("clear", handleClear);
    };
  }, []);

  return { messages, thinkingStatus };
}
