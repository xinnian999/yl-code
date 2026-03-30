import React from "react";
import { Box, Text } from "ink";
import Markdown from "ink-markdown-es";
import type { MessageBlock } from "@/core/types.ts";
import { DebugInfo } from "../shared/MessageChrome.tsx";
import { PlanMessageCard } from "./MessageDecorations.tsx";
import type { MessageListRenderItem } from "./render-item-types.ts";
import TodoList from "./TodoList.tsx";

/** AI 消息块前缀 */
const AI_BLOCK_PREFIX = "•";

/** 带前缀的 AI 行容器属性 */
export interface AIBlockRowProps {
  /** 行内容 */
  children: React.ReactNode;
  /** 前缀颜色 */
  prefixColor?: string;
}

/** 带前缀的 AI 行容器 */
export const AIBlockRow: React.FC<AIBlockRowProps> = ({
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

/** AI 内容块组件属性 */
export interface MessageBlockViewProps {
  /** 消息块数据 */
  block: MessageBlock;
  /** 是否处于流式输出中 */
  isStreaming: boolean;
}

/** 工具消息块 */
function renderToolBlock(
  block: Extract<MessageBlock, { type: "tool" }>,
): React.ReactNode {
  return (
    <>
      <AIBlockRow prefixColor="gray">
        <Text dimColor>{block.content.trimEnd()}</Text>
      </AIBlockRow>
      {block.debug ? <DebugInfo debug={block.debug} /> : null}
    </>
  );
}

/** 计划消息块 */
function renderPlanBlock(
  block: Extract<MessageBlock, { type: "plan" }>,
): React.ReactNode {
  return (
    <>
      <AIBlockRow prefixColor="cyan">
        <PlanMessageCard title={block.title} content={block.content} />
      </AIBlockRow>
      {block.debug ? <DebugInfo debug={block.debug} /> : null}
    </>
  );
}

/** 错误消息块 */
function renderErrorBlock(
  block: Extract<MessageBlock, { type: "error" }>,
): React.ReactNode {
  return (
    <>
      <AIBlockRow prefixColor="red">
        <Text color="red">{block.content.trimEnd()}</Text>
      </AIBlockRow>
      {block.debug ? <DebugInfo debug={block.debug} /> : null}
    </>
  );
}

/** 警告消息块 */
function renderWarningBlock(
  block: Extract<MessageBlock, { type: "warning" }>,
): React.ReactNode {
  return (
    <>
      <AIBlockRow prefixColor="yellow">
        <Text color="yellow">{block.content.trimEnd()}</Text>
      </AIBlockRow>
      {block.debug ? <DebugInfo debug={block.debug} /> : null}
    </>
  );
}

/** 文本消息块 */
function renderTextBlock(
  block: Extract<MessageBlock, { type: "text" }>,
  isStreaming: boolean,
): React.ReactNode {
  return (
    <>
      <AIBlockRow>
        {isStreaming ? (
          <Text>{block.content}</Text>
        ) : (
          <Markdown>{block.content}</Markdown>
        )}
      </AIBlockRow>
      {block.debug ? <DebugInfo debug={block.debug} /> : null}
    </>
  );
}

/** AI 内容块组件 */
export const MessageBlockView: React.FC<MessageBlockViewProps> = ({
  block,
  isStreaming,
}) => {
  if (block.type === "todo") {
    return (
      <>
        <AIBlockRow>
          <TodoList todos={block.todos} />
        </AIBlockRow>
        {block.debug ? <DebugInfo debug={block.debug} /> : null}
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

/** 任务更新组合块属性 */
export interface TaskUpdateViewProps {
  /** 当前任务更新渲染项 */
  item: Extract<MessageListRenderItem, { kind: "ai_task_update" }>;
}

/** 任务更新组合块 */
export const TaskUpdateView: React.FC<TaskUpdateViewProps> = ({ item }) => {
  return (
    <>
      <AIBlockRow prefixColor="gray">
        <Text dimColor>{item.toolBlock.content.trimEnd()}</Text>
        <TodoList todos={item.todoBlock.todos} />
      </AIBlockRow>
      {item.toolBlock.debug ? <DebugInfo debug={item.toolBlock.debug} /> : null}
      {item.todoBlock.debug ? <DebugInfo debug={item.todoBlock.debug} /> : null}
    </>
  );
};
