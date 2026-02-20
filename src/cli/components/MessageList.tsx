import React, { useRef } from "react";
import { Box, Text, Static } from "ink";
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
import { formatTotalDuration } from "@/core/agent-helpers.ts";

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
      marginLeft={1}
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

/** 单个消息块渲染属性 */
interface BlockRendererProps {
  block: MessageBlock;
  /** 是否为流式输出中的块 */
  isStreaming: boolean;
}

/**
 * 渲染 block 附带的 debug 信息
 */
const DebugInfo: React.FC<{ debug: string }> = ({ debug }) => (
  <Box
    marginTop={0}
    marginBottom={1}
    paddingX={1}
    borderStyle="single"
    borderColor="magenta"
    flexDirection="column"
  >
    <Text color="magenta" bold>{"🐛 DEBUG"}</Text>
    <Text color="magenta" dimColor>{debug}</Text>
  </Box>
);

/**
 * 按 block.type 分发渲染
 * 所有块正常渲染内容，debug 模式下在内容下方附加 debug 信息
 */
const BlockRenderer: React.FC<BlockRendererProps> = ({ block, isStreaming }) => {
  let content: React.ReactNode;

  switch (block.type) {
    case "todo":
      return (
        <>
          <TodoList todos={block.todos} />
          {block.debug && <DebugInfo debug={block.debug} />}
        </>
      );
    case "tool":
      content = <Text color="gray">{"🔨 "}{block.content.trimEnd()}</Text>;
      break;
    case "error":
      content = <Text color="red">{"❌ "}{block.content.trimEnd()}</Text>;
      break;
    case "warning":
      content = <Text color="yellow">{"⚠️  "}{block.content.trimEnd()}</Text>;
      break;
    case "text":
      content = isStreaming ? <Text>{block.content}</Text> : <Markdown>{block.content.trimEnd()}</Markdown>;
      break;
  }

  return (
    <>
      <Box marginBottom={1}>{content}</Box>
      {block.debug && <DebugInfo debug={block.debug} />}
    </>
  );
};

const TotalDurationBar: React.FC<{ message: AIMessageType; isRunning: boolean }> = ({ message, isRunning }) => {
  const hasDuration = typeof message.totalDurationMs === "number";
  if (!isRunning && !hasDuration) {
    return null;
  }

  const durationText = hasDuration ? formatTotalDuration(message.totalDurationMs!) : "";

  if (isRunning) {
    return (
      <Box marginTop={1}>
        <Text color="gray">
          🕒 任务计时中
          {durationText && `: ${durationText}`}
        </Text>
      </Box>
    );
  }

  const hasTokens = typeof message.totalTokensK === "number";
  const tokensText = hasTokens ? ` | 本轮消耗: ${message.totalTokensK!.toFixed(1)}K tokens` : "";

  return (
    <Box marginTop={1}>
      <Text color="gray">
        🕒 总耗时: {durationText}
        {tokensText}
      </Text>
    </Box>
  );
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
   isProcessing: boolean;
}

/**
 * AI 消息组件
 * 按 block.type 分发渲染各类型内容块
 */
const AIMessageComponent: React.FC<AIMessageProps> = ({ message, thinkingStatus, streamingBlockIndex, isLastAI, isProcessing }) => {
  const hasBlocks = message.blocks && message.blocks.length > 0;
  const isActive = thinkingStatus?.status !== undefined && thinkingStatus.status !== ThinkingStatus.IDLE;

  if (!hasBlocks && !isActive) {
    return null;
  }

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      marginLeft={1}
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
      <TotalDurationBar message={message} isRunning={isLastAI && isProcessing} />
    </Box>
  );
};

/** 单条消息组件属性 */
interface MessageItemProps {
  message: Message;
  thinkingStatus?: ThinkingState;
  /** 当前流式输出的块索引 */
  streamingBlockIndex: number;
  /** 是否为最后一条 AI 消息 */
  isLastAI: boolean;
  isProcessing: boolean;
}

/**
 * 单条消息组件
 */
const MessageItem: React.FC<MessageItemProps> = ({ message, thinkingStatus, streamingBlockIndex, isLastAI, isProcessing }) => {
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
        isProcessing={isProcessing}
      />
    );
  }

  return null;
};

/** 消息列表组件属性 */
interface MessageListProps {
  messages: Message[];
  thinkingStatus: ThinkingState;
  /** 当前流式输出的块索引（-1 表示无流式输出） */
  streamingBlockIndex: number;
  isProcessing: boolean;
}

/**
 * 消息列表组件
 * 使用 Ink Static 将已完成消息从 yoga 布局树中移除，
 * 仅保留最近 2 条消息参与动态布局，解决长列表导致的输入卡顿
 */
const MessageList = React.memo<MessageListProps>(({ messages, thinkingStatus, streamingBlockIndex, isProcessing }) => {
  /** 已提交到 Static 的消息数量（单调递增，Static 渲染后不可撤回） */
  const committedRef = useRef(0);

  // 判断当前是否有活跃输出（流式输出中或思考中）
  const isOutputting = streamingBlockIndex !== -1 ||
    (thinkingStatus?.status !== undefined && thinkingStatus.status !== ThinkingStatus.IDLE);

  // 活跃时保留最后 2 条消息为动态区域（处理思考状态在 AI 消息创建前的间隙）
  // 空闲时全部提交到 Static，让动态区域清空，输入零开销
  const safeCommitBoundary = isOutputting
    ? Math.max(0, messages.length - 2)
    : messages.length;

  // 消息被清空或恢复时（数量骤降），重置提交计数
  if (messages.length < committedRef.current) {
    committedRef.current = 0;
  }

  // 只增不减：一旦提交到 Static 就不可回退
  committedRef.current = Math.max(committedRef.current, safeCommitBoundary);
  const committed = Math.min(committedRef.current, messages.length);

  const staticMessages = messages.slice(0, committed);
  const activeMessages = messages.slice(committed);

  // 查找最后一条 AI 消息的全局索引
  let lastAIIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].type === MessageType.AI) {
      lastAIIndex = i;
      break;
    }
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Static items={staticMessages}>
        {(msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            streamingBlockIndex={-1}
            isLastAI={false}
            isProcessing={false}
          />
        )}
      </Static>
      {activeMessages.map((msg, i) => {
        const globalIndex = committed + i;
        const isLastAI = globalIndex === lastAIIndex;
        return (
          <MessageItem
            key={msg.id}
            message={msg}
            thinkingStatus={isLastAI ? thinkingStatus : undefined}
            streamingBlockIndex={isLastAI ? streamingBlockIndex : -1}
            isLastAI={isLastAI}
            isProcessing={isProcessing}
          />
        );
      })}
    </Box>
  );
});

export default MessageList;
