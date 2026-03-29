import React from "react";
import { Box, Text } from "ink";
import Markdown from "ink-markdown-es";
import type { ConfirmResult, MessageBlock } from "@/core/types.ts";
import { formatTotalDuration } from "@/core/agent-helpers.ts";
import DiffConfirm from "./DiffConfirm.tsx";
import { AssistantSection, DebugInfo, UserBubble } from "./MessageItemChrome.tsx";
import PlanMessageBlock from "./PlanMessageBlock.tsx";
import StatusBar from "./StatusBar.tsx";
import TodoList from "./TodoList.tsx";
import WelcomeCard from "./WelcomeCard.tsx";
import type { MessageListRenderItem } from "./MessageListRenderTypes.ts";

/** AI 消息块前缀 */
const AI_BLOCK_PREFIX = "•";

/** AI 内容块组件属性 */
interface BlockContentProps {
  /** 消息块数据 */
  block: MessageBlock;
  /** 是否处于流式输出中 */
  isStreaming: boolean;
}

/** 带前缀的 AI 行容器属性 */
interface AIBlockRowProps {
  /** 行内容 */
  children: React.ReactNode;
  /** 前缀颜色 */
  prefixColor?: string;
}

/** 带前缀的 AI 行容器 */
const AIBlockRow: React.FC<AIBlockRowProps> = ({
  children,
  prefixColor = "gray",
}) => {
  return (
    <Box width="100%" marginBottom={1}>
      <Box width={2} justifyContent="flex-start">
        <Text color={prefixColor}>{AI_BLOCK_PREFIX}</Text>
      </Box>
      <Box flexDirection="column" flexGrow={1}>
        {children}
      </Box>
    </Box>
  );
};

/** 工具消息块 */
function renderToolBlock(
  block: Extract<MessageBlock, { type: "tool" }>
): React.ReactNode {
  return (
    <>
      <AIBlockRow prefixColor="gray">
        <Text dimColor>{block.content.trimEnd()}</Text>
      </AIBlockRow>
      {block.debug && <DebugInfo debug={block.debug} />}
    </>
  );
}

/** 计划消息块 */
function renderPlanBlock(
  block: Extract<MessageBlock, { type: "plan" }>
): React.ReactNode {
  return (
    <>
      <AIBlockRow prefixColor="cyan">
        <PlanMessageBlock title={block.title} content={block.content} />
      </AIBlockRow>
      {block.debug && <DebugInfo debug={block.debug} />}
    </>
  );
}

/** 错误消息块 */
function renderErrorBlock(
  block: Extract<MessageBlock, { type: "error" }>
): React.ReactNode {
  return (
    <>
      <AIBlockRow prefixColor="red">
        <Text color="red">{block.content.trimEnd()}</Text>
      </AIBlockRow>
      {block.debug && <DebugInfo debug={block.debug} />}
    </>
  );
}

/** 警告消息块 */
function renderWarningBlock(
  block: Extract<MessageBlock, { type: "warning" }>
): React.ReactNode {
  return (
    <>
      <AIBlockRow prefixColor="yellow">
        <Text color="yellow">{block.content.trimEnd()}</Text>
      </AIBlockRow>
      {block.debug && <DebugInfo debug={block.debug} />}
    </>
  );
}

/** 文本消息块 */
function renderTextBlock(
  block: Extract<MessageBlock, { type: "text" }>,
  isStreaming: boolean
): React.ReactNode {
  return (
    <>
      <AIBlockRow>
        {isStreaming ? <Text>{block.content}</Text> : <Markdown>{block.content}</Markdown>}
      </AIBlockRow>
      {block.debug && <DebugInfo debug={block.debug} />}
    </>
  );
}

/** AI 内容块组件 */
const BlockContent: React.FC<BlockContentProps> = ({ block, isStreaming }) => {
  if (block.type === "todo") {
    return (
      <>
        <AIBlockRow>
          <TodoList todos={block.todos} />
        </AIBlockRow>
        {block.debug && <DebugInfo debug={block.debug} />}
      </>
    );
  }

  if (block.type === "plan") {
    return renderPlanBlock(block);
  }

  if (block.type === "tool") {
    return renderToolBlock(block);
  }

  if (block.type === "error") {
    return renderErrorBlock(block);
  }

  if (block.type === "warning") {
    return renderWarningBlock(block);
  }

  return renderTextBlock(block, isStreaming);
};

/** 任务更新组合块 */
function renderTaskUpdateBlock(
  item: Extract<MessageListRenderItem, { kind: "ai_task_update" }>
): React.ReactNode {
  return (
    <>
      <AIBlockRow prefixColor="gray">
        <Text dimColor>{item.toolBlock.content.trimEnd()}</Text>
        <TodoList todos={item.todoBlock.todos} />
      </AIBlockRow>
      {item.toolBlock.debug && <DebugInfo debug={item.toolBlock.debug} />}
      {item.todoBlock.debug && <DebugInfo debug={item.todoBlock.debug} />}
    </>
  );
}

/** 渲染项组件属性 */
interface RenderItemProps {
  /** 当前渲染项 */
  item: MessageListRenderItem;
  /** diff 确认回调 */
  onDiffConfirm: (result: ConfirmResult) => void;
}

/** 构建计时状态文本 */
function buildTimerText(
  item: Extract<MessageListRenderItem, { kind: "ai_stats" }>
): string {
  const durationText = typeof item.message.totalDurationMs === "number"
    ? formatTotalDuration(item.message.totalDurationMs)
    : "";

  if (item.isPaused) {
    return "🕒 等待用户确认";
  }

  if (item.isRunning) {
    return `🕒 任务计时中${durationText ? `: ${durationText}` : ""}`;
  }

  return `🕒 总耗时: ${durationText}`;
}

/** 单个扁平渲染项组件 */
export const MessageListRenderItemView: React.FC<RenderItemProps> = ({
  item,
  onDiffConfirm,
}) => {
  if (item.kind === "welcome") {
    return <WelcomeCard modelId={item.modelId} version={item.version} />;
  }

  if (item.kind === "user") {
    return <UserBubble content={item.message.content} />;
  }

  if (item.kind === "ai_block") {
    return (
      <AssistantSection>
        <BlockContent block={item.block} isStreaming={item.isStreaming} />
      </AssistantSection>
    );
  }

  if (item.kind === "ai_task_update") {
    return <AssistantSection>{renderTaskUpdateBlock(item)}</AssistantSection>;
  }

  if (item.kind === "ai_diff") {
    return (
      <AssistantSection>
        <AIBlockRow>
          <DiffConfirm
            change={item.pendingChange}
            onConfirm={onDiffConfirm}
            editorOpened={item.diffEditorOpened}
          />
        </AIBlockRow>
      </AssistantSection>
    );
  }

  if (!item.isRunning && typeof item.message.totalDurationMs !== "number") {
    return null;
  }

  return (
    <AssistantSection>
      <AIBlockRow>
        <StatusBar
          thinkingStatus={item.thinkingStatus}
          timerText={buildTimerText(item)}
          hideThinking={item.isPaused}
        />
      </AIBlockRow>
    </AssistantSection>
  );
};
