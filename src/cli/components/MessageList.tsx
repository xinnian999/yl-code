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
  messages: Message[];
  thinkingStatus: ThinkingState;
  streamingBlockIndex: number;
  isProcessing: boolean;
  showDiffConfirm: boolean;
  pendingChange: PendingChange | null;
  diffEditorOpened: EditorType | null;
  onDiffConfirm: (result: ConfirmResult) => void;
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
    <Box flexDirection="column" flexGrow={1}>
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
