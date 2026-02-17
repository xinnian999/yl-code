import React from "react";
import { Box, Text } from "ink";
import Markdown from "ink-markdown-es";
import { MessageType, ThinkingStatus } from "@/core/types.ts";
import type { ThinkingState, TodoItem } from "@/core/types.ts";
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

/** AI 消息组件属性 */
interface AIMessageProps {
  message: AIMessageType;
  /** 思考状态，仅最后一条 AI 消息传入 */
  thinkingStatus?: ThinkingState;
  /** 该消息绑定的任务列表 */
  todos?: TodoItem[];
  /** 当前流式输出的块索引（-1 表示无流式输出） */
  streamingBlockIndex: number;
  /** 是否为最后一条 AI 消息 */
  isLastAI: boolean;
}

/**
 * AI 消息组件（memo 避免无关重渲染）
 * 每条 AI 消息显示自己绑定的任务列表，最后一条显示思考状态
 * 流式输出中的块使用纯文本渲染，完成后切换为 Markdown 渲染
 */
const AIMessageComponent = React.memo<AIMessageProps>(({ message, thinkingStatus, todos, streamingBlockIndex, isLastAI }) => {
  const hasBlocks = message.blocks && message.blocks.length > 0;
  const isActive = thinkingStatus?.status !== undefined && thinkingStatus.status !== ThinkingStatus.IDLE;
  const hasTodos = todos && todos.length > 0;

  if (!hasBlocks && !isActive && !hasTodos) {
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
      {hasBlocks && message.blocks.map((block, index) => {
        const isStreaming = isLastAI && streamingBlockIndex === index;
        return (
          <Box key={index} marginBottom={1}>
            {isStreaming ? <Text>{block}</Text> : <Markdown>{block}</Markdown>}
          </Box>
        );
      })}
      {isActive && <StatusBar thinkingStatus={thinkingStatus} />}
      {hasTodos && <TodoList todos={todos} />}
    </Box>
  );
});

/** 单条消息组件属性 */
interface MessageItemProps {
  message: Message;
  thinkingStatus?: ThinkingState;
  todos?: TodoItem[];
  /** 当前流式输出的块索引 */
  streamingBlockIndex: number;
  /** 是否为最后一条 AI 消息 */
  isLastAI: boolean;
}

/**
 * 单条消息组件（memo 避免无关重渲染）
 */
const MessageItem = React.memo<MessageItemProps>(({ message, thinkingStatus, todos, streamingBlockIndex, isLastAI }) => {
  if (message.type === MessageType.USER) {
    return <UserMessage message={message as UserMessageType} />;
  }

  if (message.type === MessageType.AI) {
    return (
      <AIMessageComponent
        message={message as AIMessageType}
        thinkingStatus={thinkingStatus}
        todos={todos}
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
  todosMap: Map<string, TodoItem[]>;
  /** 当前流式输出的块索引（-1 表示无流式输出） */
  streamingBlockIndex: number;
}

/**
 * 消息列表组件（memo 避免输入框变化导致的无关重渲染）
 * 渲染所有历史消息，每条 AI 消息显示自己绑定的任务列表
 */
const MessageList = React.memo<MessageListProps>(({ messages, thinkingStatus, todosMap, streamingBlockIndex }) => {
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
        const todos = todosMap.get(msg.id);
        return (
          <MessageItem
            key={msg.id}
            message={msg}
            thinkingStatus={isLastAI ? thinkingStatus : undefined}
            todos={todos}
            streamingBlockIndex={streamingBlockIndex}
            isLastAI={isLastAI}
          />
        );
      })}
    </Box>
  );
});

export default MessageList;
