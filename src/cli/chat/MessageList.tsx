import React, { useRef } from "react";
import { Box, Static } from "ink";
import type { PendingChange } from "@/core/confirm-bus.ts";
import type { EditorType } from "@/core/editor-detector.ts";
import type { Message } from "@/core/message-bus.ts";
import type { ThinkingState } from "@/core/types.ts";
import type { PendingPlanInteraction } from "@/core/plan/plan-bus.ts";
import { MessageItemView } from "./MessageItemView.tsx";
import type { BuildRenderItemsOptions } from "./render-item-types.ts";
import { buildRenderItems, getDynamicTailCount } from "./render-items.ts";

/** 消息列表组件属性 */
export interface MessageListProps {
  /** 全部消息 */
  messages: Message[];
  /** 当前思考状态 */
  thinkingStatus: ThinkingState;
  /** 当前流式块索引 */
  streamingBlockIndex: number;
  /** 是否处理中 */
  isProcessing: boolean;
  /** 当前待确认变更 */
  pendingChange: PendingChange | null;
  /** 已打开的编辑器类型 */
  diffEditorOpened: EditorType | null;
  /** 当前待处理的计划交互 */
  pendingPlanInteraction: PendingPlanInteraction | null;
  /** 当前模型 ID */
  modelId: string;
  /** 应用版本号 */
  version: string;
  /** 是否存在项目规则文件 */
  hasProjectRules: boolean;
}

/** 消息列表组件 */
const MessageList = React.memo<MessageListProps>(
  ({
    messages,
    thinkingStatus,
    streamingBlockIndex,
    isProcessing,
    pendingChange,
    diffEditorOpened,
    pendingPlanInteraction,
    modelId,
    version,
    hasProjectRules,
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
      pendingChange,
      diffEditorOpened,
      pendingPlanInteraction,
      modelId,
      version,
      hasProjectRules,
    } satisfies BuildRenderItemsOptions);
    const dynamicTailCount = getDynamicTailCount(renderItems);
    const safeCommitBoundary = Math.max(
      0,
      renderItems.length - dynamicTailCount,
    );

    committedRef.current = Math.max(committedRef.current, safeCommitBoundary);

    const committed = Math.min(committedRef.current, renderItems.length);
    const staticItems = renderItems.slice(0, committed);
    const activeItems = renderItems.slice(committed);

    lastMessageCountRef.current = messages.length;
    firstMessageIdRef.current = messages[0]?.id ?? "";

    return (
      <Box
        width="100%"
        flexDirection="column"
        flexGrow={1}
        alignItems="stretch"
      >
        <Static items={staticItems}>
          {(item) => <MessageItemView key={item.id} item={item} />}
        </Static>
        {activeItems.map((item) => (
          <MessageItemView key={item.id} item={item} />
        ))}
      </Box>
    );
  },
);

export default MessageList;
