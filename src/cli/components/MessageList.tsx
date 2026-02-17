import React from "react";
import { Box, Text } from "ink";
import { MessageType, ThinkingStatus } from "@/core/types.ts";
import type { ThinkingState } from "@/core/types.ts";
import type { TodoItem } from "@/core/types.ts";
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
  /** 任务列表，仅最后一条 AI 消息传入 */
  todos?: TodoItem[];
}

/**
 * AI 消息组件（支持多内容块）
 * 最后一条 AI 消息会在内部尾部显示状态栏和任务列表
 */
const AIMessageComponent: React.FC<AIMessageProps> = ({ message, thinkingStatus, todos }) => {
  const hasBlocks = message.blocks && message.blocks.length > 0;
  const isActive = thinkingStatus?.status !== undefined && thinkingStatus.status !== ThinkingStatus.IDLE;
  const hasTodos = todos && todos.length > 0;

  // 没有内容块且没有活跃状态且没有任务时不渲染
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
      {hasBlocks && message.blocks.map((block, index) => (
        <Box key={index} marginBottom={1}>
          <Text>{block}</Text>
        </Box>
      ))}
      {isActive && <StatusBar thinkingStatus={thinkingStatus} />}
      {hasTodos && <TodoList todos={todos} />}
    </Box>
  );
};

/** 单条消息组件属性 */
interface MessageItemProps {
  message: Message;
  /** 思考状态，仅最后一条 AI 消息传入 */
  thinkingStatus?: ThinkingState;
  /** 任务列表，仅最后一条 AI 消息传入 */
  todos?: TodoItem[];
}

/**
 * 单条消息组件
 */
const MessageItem: React.FC<MessageItemProps> = ({ message, thinkingStatus, todos }) => {
  if (message.type === MessageType.USER) {
    return <UserMessage message={message as UserMessageType} />;
  }

  if (message.type === MessageType.AI) {
    return (
      <AIMessageComponent
        message={message as AIMessageType}
        thinkingStatus={thinkingStatus}
        todos={todos}
      />
    );
  }

  return null;
};

/** 消息列表组件属性 */
interface MessageListProps {
  messages: Message[];
  thinkingStatus: ThinkingState;
  todos: TodoItem[];
}

/**
 * 消息列表组件
 * 渲染所有历史消息，最后一条 AI 消息内部显示当前状态和任务列表
 */
const MessageList: React.FC<MessageListProps> = ({ messages, thinkingStatus, todos }) => {
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
      {messages.map((msg, index) => {
        const isLastAI = index === lastAIIndex;
        return (
          <MessageItem
            key={msg.id}
            message={msg}
            thinkingStatus={isLastAI ? thinkingStatus : undefined}
            todos={isLastAI ? todos : undefined}
          />
        );
      })}
    </Box>
  );
};

export default MessageList;
