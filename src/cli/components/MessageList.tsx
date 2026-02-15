import React from "react";
import { Box, Text } from "ink";
import { MessageType } from "@/core/types.ts";
import type {
  Message,
  UserMessage as UserMessageType,
  AIMessage as AIMessageType,
} from "@/core/message-bus.ts";

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
}

/**
 * AI 消息组件（支持多内容块）
 */
const AIMessageComponent: React.FC<AIMessageProps> = ({ message }) => {
  // 如果没有块或块为空，不渲染
  if (!message.blocks || message.blocks.length === 0) {
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
      // backgroundColor="#333333"
    >
      {message.blocks.map((block, index) => (
        <Box key={index} marginBottom={1}>
          <Text>{block}</Text>
        </Box>
      ))}
    </Box>
  );
};

/** 单条消息组件属性 */
interface MessageItemProps {
  message: Message;
}

/**
 * 单条消息组件
 */
const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
  if (message.type === MessageType.USER) {
    return <UserMessage message={message as UserMessageType} />;
  }

  if (message.type === MessageType.AI) {
    return <AIMessageComponent message={message as AIMessageType} />;
  }

  return null;
};

/** 消息列表组件属性 */
interface MessageListProps {
  messages: Message[];
}

/**
 * 消息列表组件
 * 渲染所有历史消息
 */
const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </Box>
  );
};

export default MessageList;
