import React from "react";
import { Box, Text } from "ink";
import Markdown from "ink-markdown-es";
import { MessageType, ThinkingStatus } from "@/core/types.ts";
import type { ThinkingState, MessageBlock } from "@/core/types.ts";
import type {
  Message,
  UserMessage as UserMessageType,
  AIMessage as AIMessageType,
} from "@/core/message-bus.ts";
import StatusBar from "./StatusBar.tsx";
import TodoList from "./TodoList.tsx";

/** 用户消息组件属性 */
interface UserMessageProps {
  message: UserMessageType;
}

/**
 * 用户消息组件（memo 避免无关重渲染）
 */
const UserMessage = React.memo<UserMessageProps>(({ message }) => {
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
});

/** 单个消息块渲染属性 */
interface BlockRendererProps {
  block: MessageBlock;
  /** 是否为流式输出中的块 */
  isStreaming: boolean;
}

/**
 * 按 block.type 分发渲染
 */
const BlockRenderer: React.FC<BlockRendererProps> = ({ block, isStreaming }) => {
  switch (block.type) {
    case "todo":
      return <TodoList todos={block.todos} />;
    case "tool":
      return (
        <Box marginBottom={1}>
          <Text color="gray">{"🔨 "}{block.content}</Text>
        </Box>
      );
    case "error":
      return (
        <Box marginBottom={1}>
          <Text color="red">{"❌ "}{block.content}</Text>
        </Box>
      );
    case "warning":
      return (
        <Box marginBottom={1}>
          <Text color="yellow">{"⚠️  "}{block.content}</Text>
        </Box>
      );
    case "debug":
      return (
        <Box marginBottom={1}>
          <Text color="gray">{"🐛 "}{block.content}</Text>
        </Box>
      );
    case "text":
      return (
        <Box marginBottom={1}>
          {isStreaming ? <Text>{block.content}</Text> : <Markdown>{block.content}</Markdown>}
        </Box>
      );
  }
};

/** AI 消息组件属性 */
interface AIMessageProps {
  message: AIMessageType;
  /** 思考状态，仅最后一条 AI 消息传入 */
  thinkingStatus?: ThinkingState;
  /** 当前流式输出的块索引（-1 表示无流式输出） */
  streamingBlockIndex: number;
  /** 是否为最后一条 AI 消息 */
  isLastAI: boolean;
}

/**
 * AI 消息组件（memo 避免无关重渲染）
 * 按 block.type 分发渲染各类型内容块
 */
const AIMessageComponent = React.memo<AIMessageProps>(({ message, thinkingStatus, streamingBlockIndex, isLastAI }) => {
  const hasBlocks = message.blocks && message.blocks.length > 0;
  const isActive = thinkingStatus?.status !== undefined && thinkingStatus.status !== ThinkingStatus.IDLE;

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
        <BlockRenderer
          key={index}
          block={block}
          isStreaming={isLastAI && streamingBlockIndex === index}
        />
      ))}
      {isActive && <StatusBar thinkingStatus={thinkingStatus} />}
    </Box>
  );
});

/** 单条消息组件属性 */
interface MessageItemProps {
  message: Message;
  thinkingStatus?: ThinkingState;
  /** 当前流式输出的块索引 */
  streamingBlockIndex: number;
  /** 是否为最后一条 AI 消息 */
  isLastAI: boolean;
}

/**
 * 单条消息组件（memo 避免无关重渲染）
 */
const MessageItem = React.memo<MessageItemProps>(({ message, thinkingStatus, streamingBlockIndex, isLastAI }) => {
  if (message.type === MessageType.USER) {
    return <UserMessage message={message as UserMessageType} />;
  }

  if (message.type === MessageType.AI) {
    return (
      <AIMessageComponent
        message={message as AIMessageType}
        thinkingStatus={thinkingStatus}
        streamingBlockIndex={streamingBlockIndex}
        isLastAI={isLastAI}
      />
    );
  }

  return null;
});

/** 消息列表组件属性 */
interface MessageListProps {
  messages: Message[];
  thinkingStatus: ThinkingState;
  /** 当前流式输出的块索引（-1 表示无流式输出） */
  streamingBlockIndex: number;
}

/**
 * 消息列表组件（memo 避免输入框变化导致的无关重渲染）
 * 渲染所有历史消息，各类型块内联渲染
 */
const MessageList = React.memo<MessageListProps>(({ messages, thinkingStatus, streamingBlockIndex }) => {
  let lastAIIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === MessageType.AI) {
      lastAIIndex = i;
      break;
    }
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {messages.map((msg, index) => {
        const isLastAI = index === lastAIIndex;
        return (
          <MessageItem
            key={msg.id}
            message={msg}
            thinkingStatus={isLastAI ? thinkingStatus : undefined}
            streamingBlockIndex={streamingBlockIndex}
            isLastAI={isLastAI}
          />
        );
      })}
    </Box>
  );
});

export default MessageList;
