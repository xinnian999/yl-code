import React, { useRef } from "react";
import { Box, Static } from "ink";
import type { PendingChange } from "@/core/confirm-bus.ts";
import type { EditorType } from "@/core/editor-detector.ts";
import type { Message } from "@/core/message-bus.ts";
import type { ConfirmResult, ThinkingState } from "@/core/types.ts";
import { MessageListRenderItemView } from "./MessageListRenderers.tsx";
import { buildRenderItems, getDynamicTailCount } from "./message-list-utils.ts";

/** 消息列表组件属性 */
interface MessageListProps {
  /** 全部消息 */
  messages: Message[];
  /** 当前思考状态 */
  thinkingStatus: ThinkingState;
  /** 当前流式块索引 */
  streamingBlockIndex: number;
  /** 是否处理中 */
  isProcessing: boolean;
  /** 是否展示 diff 确认 */
  showDiffConfirm: boolean;
  /** 当前待确认变更 */
  pendingChange: PendingChange | null;
  /** 已打开的编辑器类型 */
  diffEditorOpened: EditorType | null;
  /** diff 确认回调 */
  onDiffConfirm: (result: ConfirmResult) => void;
  /** 当前模型 ID，用于欢迎卡片 */
  modelId: string;
  /** 应用版本号，用于欢迎卡片 */
  version: string;
}

/** 消息列表组件 */
const MessageList = React.memo<MessageListProps>(({
  messages,
  thinkingStatus,
  streamingBlockIndex,
  isProcessing,
  showDiffConfirm,
  pendingChange,
  diffEditorOpened,
  onDiffConfirm,
  modelId,
  version,
}) => {
  const committedRef = useRef(0);
  const lastMessageCountRef = useRef(messages.length);
  const firstMessageIdRef = useRef(messages[0]?.id ?? "");

  if (
    messages.length < lastMessageCountRef.current ||
    firstMessageIdRef.current !== (messages[0]?.id ?? "")
  ) {
    committedRef.current = 0;
  }

  const renderItems = buildRenderItems({
    messages,
    thinkingStatus,
    streamingBlockIndex,
    isProcessing,
    showDiffConfirm,
    pendingChange,
    diffEditorOpened,
    modelId,
    version,
  });
  const dynamicTailCount = getDynamicTailCount(renderItems);
  const safeCommitBoundary = Math.max(0, renderItems.length - dynamicTailCount);

  committedRef.current = Math.max(committedRef.current, safeCommitBoundary);

  const committed = Math.min(committedRef.current, renderItems.length);
  const staticItems = renderItems.slice(0, committed);
  const activeItems = renderItems.slice(committed);

  lastMessageCountRef.current = messages.length;
  firstMessageIdRef.current = messages[0]?.id ?? "";

  return (
    <Box width="100%" flexDirection="column" flexGrow={1} alignItems="stretch">
      <Static items={staticItems}>
        {(item) => (
          <MessageListRenderItemView
            key={item.id}
            item={item}
            onDiffConfirm={onDiffConfirm}
          />
        )}
      </Static>
      {activeItems.map((item) => (
        <MessageListRenderItemView
          key={item.id}
          item={item}
          onDiffConfirm={onDiffConfirm}
        />
      ))}
    </Box>
  );
});

export default MessageList;
