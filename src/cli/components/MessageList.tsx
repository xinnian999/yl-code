import React from "react";
import { Box, Text } from "ink";
import { MessageType, ThinkingStatus } from "@/core/types.ts";
import type { ThinkingState } from "@/core/types.ts";
import type {
  Message,
  UserMessage as UserMessageType,
  AIMessage as AIMessageType,
} from "@/core/message-bus.ts";
import StatusBar from "./StatusBar.tsx";

/** 用户消息组件属性 */
interface UserMessageProps {
  message: UserMessageType;
}

/**
 * 用户消息组件
 */
const UserMessage: React.FC<UserMessageProps> = ({ message }) => {
  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="bold"
      borderColor="cyan"
      borderLeft={true}
      borderTop={false}
      borderBottom={false}
      borderRight={false}
      padding={1}
    >
      <Text color="cyan">{message.content}</Text>
    </Box>
  );
};

/** AI 消息组件属性 */
interface AIMessageProps {
  message: AIMessageType;
  /** 思考状态，仅最后一条 AI 消息传入 */
  thinkingStatus?: ThinkingState;
}

/**
 * AI 消息组件（支持多内容块）
 * 最后一条 AI 消息会在内部尾部显示当前状态
 */
const AIMessageComponent: React.FC<AIMessageProps> = ({ message, thinkingStatus }) => {
  const hasBlocks = message.blocks && message.blocks.length > 0;
  const isActive = thinkingStatus?.status !== undefined && thinkingStatus.status !== ThinkingStatus.IDLE;

  // 没有内容块且没有活跃状态时不渲染
  if (!hasBlocks && !isActive) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      borderStyle="bold"
      borderColor="green"
      borderLeft={true}
      borderTop={false}
      borderBottom={false}
      borderRight={false}
      padding={1}
    >
      {hasBlocks && message.blocks.map((block, index) => (
        <Box key={index} marginBottom={1}>
          <Text>{block}</Text>
        </Box>
      ))}
      {isActive && <StatusBar thinkingStatus={thinkingStatus} />}
    </Box>
  );
};

/** 单条消息组件属性 */
interface MessageItemProps {
  message: Message;
  /** 思考状态，仅最后一条 AI 消息传入 */
  thinkingStatus?: ThinkingState;
}

/**
 * 单条消息组件
 */
const MessageItem: React.FC<MessageItemProps> = ({ message, thinkingStatus }) => {
  if (message.type === MessageType.USER) {
    return <UserMessage message={message as UserMessageType} />;
  }

  if (message.type === MessageType.AI) {
    return <AIMessageComponent message={message as AIMessageType} thinkingStatus={thinkingStatus} />;
  }

  return null;
};

/** 消息列表组件属性 */
interface MessageListProps {
  messages: Message[];
  thinkingStatus: ThinkingState;
}

/**
 * 消息列表组件
 * 渲染所有历史消息，最后一条 AI 消息内部显示当前状态
 */
const MessageList: React.FC<MessageListProps> = ({ messages, thinkingStatus }) => {
  // 找到最后一条 AI 消息的索引
  let lastAIIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === MessageType.AI) {
      lastAIIndex = i;
      break;
    }
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg, index) => (
        <MessageItem
          key={msg.id}
          message={msg}
          thinkingStatus={index === lastAIIndex ? thinkingStatus : undefined}
        />
      ))}
    </Box>
  );
};

export default MessageList;
