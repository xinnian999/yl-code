import React from "react";
import { Box, Text } from "ink";
import { MessageType, BlockType } from "../utils/message-bus.js";

/**
 * 根据块类型获取样式配置
 */
const getBlockStyle = (blockType) => {
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

/**
 * 内容块组件
 */
const BlockItem = ({ block }) => {
  const style = getBlockStyle(block.type);

  return (
    <Box>
      <Text color={style.color}>
        {style.prefix}{block.content}
      </Text>
    </Box>
  );
};

/**
 * 用户消息组件
 */
const UserMessage = ({ message }) => {
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

/**
 * AI 消息组件（支持多内容块）
 */
const AIMessage = ({ message }) => {
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
    >
      {message.blocks.map((block, index) => (
        <BlockItem key={index} block={block} />
      ))}
    </Box>
  );
};

/**
 * 单条消息组件
 */
const MessageItem = ({ message }) => {
  if (message.type === MessageType.USER) {
    return <UserMessage message={message} />;
  }

  if (message.type === MessageType.AI) {
    return <AIMessage message={message} />;
  }

  return null;
};

/**
 * 消息列表组件
 * 渲染所有历史消息
 */
const MessageList = ({ messages }) => {
  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg) => (
        <MessageItem key={msg.id} message={msg} />
      ))}
    </Box>
  );
};

export default MessageList;
