import React from "react";
import { Box, Text } from "ink";
import Markdown from "ink-markdown-es";
import type { ConfirmResult, MessageBlock } from "@/core/types.ts";
import { formatTotalDuration } from "@/core/agent-helpers.ts";
import DiffConfirm from "./DiffConfirm.tsx";
import StatusBar from "./StatusBar.tsx";
import TodoList from "./TodoList.tsx";
import type { MessageListRenderItem } from "./MessageListRenderTypes.ts";

/** AI 卡片外框属性 */
interface AIFrameProps {
  children: React.ReactNode;
}

/** AI 卡片外框组件 */
const AIFrame: React.FC<AIFrameProps> = ({ children }) => {
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
      {children}
    </Box>
  );
};

/** 用户消息组件属性 */
interface UserMessageProps {
  content: string;
}

/** 用户消息组件 */
const UserMessage: React.FC<UserMessageProps> = ({ content }) => {
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
      <Text color="cyan">{content}</Text>
    </Box>
  );
};

/** 调试信息组件属性 */
interface DebugInfoProps {
  debug: string;
}

/** 调试信息组件 */
const DebugInfo: React.FC<DebugInfoProps> = ({ debug }) => {
  return (
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
};

/** AI 内容块组件属性 */
interface BlockContentProps {
  block: MessageBlock;
  isStreaming: boolean;
}

/** AI 内容块组件 */
const BlockContent: React.FC<BlockContentProps> = ({ block, isStreaming }) => {
  if (block.type === "todo") {
    return (
      <>
        <TodoList todos={block.todos} />
        {block.debug && <DebugInfo debug={block.debug} />}
      </>
    );
  }

  if (block.type === "tool") {
    return (
      <>
        <Box marginBottom={1}>
          <Text color="gray">{"🔨 "}{block.content.trimEnd()}</Text>
        </Box>
        {block.debug && <DebugInfo debug={block.debug} />}
      </>
    );
  }

  if (block.type === "error") {
    return (
      <>
        <Box marginBottom={1}>
          <Text color="red">{"❌ "}{block.content.trimEnd()}</Text>
        </Box>
        {block.debug && <DebugInfo debug={block.debug} />}
      </>
    );
  }

  if (block.type === "warning") {
    return (
      <>
        <Box marginBottom={1}>
          <Text color="yellow">{"⚠️  "}{block.content.trimEnd()}</Text>
        </Box>
        {block.debug && <DebugInfo debug={block.debug} />}
      </>
    );
  }

  return (
    <>
      <Box marginBottom={1}>
        {isStreaming ? <Text>{block.content}</Text> : <Markdown>{block.content}</Markdown>}
      </Box>
      {block.debug && <DebugInfo debug={block.debug} />}
    </>
  );
};

/** 渲染项组件属性 */
interface RenderItemProps {
  item: MessageListRenderItem;
  onDiffConfirm: (result: ConfirmResult) => void;
}

/** 单个扁平渲染项组件 */
export const MessageListRenderItemView: React.FC<RenderItemProps> = ({ item, onDiffConfirm }) => {
  if (item.kind === "user") {
    return <UserMessage content={item.message.content} />;
  }

  if (item.kind === "ai_block") {
    return (
      <AIFrame>
        <BlockContent block={item.block} isStreaming={item.isStreaming} />
      </AIFrame>
    );
  }

  if (item.kind === "ai_status") {
    return (
      <AIFrame>
        <StatusBar thinkingStatus={item.thinkingStatus} />
      </AIFrame>
    );
  }

  if (item.kind === "ai_diff") {
    return (
      <AIFrame>
        <DiffConfirm
          change={item.pendingChange}
          onConfirm={onDiffConfirm}
          editorOpened={item.diffEditorOpened}
        />
      </AIFrame>
    );
  }

  if (!item.isRunning && typeof item.message.totalDurationMs !== "number") {
    return null;
  }

  const durationText = typeof item.message.totalDurationMs === "number"
    ? formatTotalDuration(item.message.totalDurationMs)
    : "";
  const tokensText = typeof item.message.totalTokensK === "number"
    ? ` | 本轮消耗: ${item.message.totalTokensK.toFixed(1)}K tokens`
    : "";
  const text = item.isRunning
    ? `🕒 任务计时中${durationText ? `: ${durationText}` : ""}`
    : `🕒 总耗时: ${durationText}${tokensText}`;

  return (
    <AIFrame>
      <Text color="gray">{text}</Text>
    </AIFrame>
  );
};
