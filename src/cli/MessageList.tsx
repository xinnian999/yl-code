import React from "react";
import { Box, Text } from "ink";
import { 
  MessageType, 
  BlockType, 
  type Message, 
  type Block, 
  type UserMessage as UserMessageType, 
  type AIMessage as AIMessageType,
  type BlockTypeValue 
} from "../utils/message-bus.ts";

interface BlockStyle {
  color: string;
  prefix: string;
}

/**
 * 根据块类型获取样式配置
 */
const getBlockStyle = (blockType: BlockTypeValue): BlockStyle => {
  switch (blockType) {
    case BlockType.TEXT:
      return {
        color: "green",
        prefix: "",
      };
    case BlockType.TOOL:
      return {
        color: "blueBright",
        prefix: "🔨 ",
      };
    case BlockType.ERROR:
      return {
        color: "red",
        prefix: "❌ ",
      };
    case BlockType.WARNING:
      return {
        color: "yellow",
        prefix: "⚠️  ",
      };
    default:
      return {
        color: "white",
        prefix: "",
      };
  }
};

interface BlockItemProps {
  block: Block;
}

/**
 * 内容块组件
 */
const BlockItem: React.FC<BlockItemProps> = ({ block }) => {
  const style = getBlockStyle(block.type);

  return (
    <Box>
      <Text color='#ffffff'>
        {style.prefix}{block.content}
      </Text>
    </Box>
  );
};

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
      backgroundColor="#333333"
    >
      {message.blocks.map((block, index) => (
        <BlockItem key={index} block={block} />
      ))}
    </Box>
  );
};

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
