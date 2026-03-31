import React from "react";
import {
  AssistantSection,
  UserBubble,
} from "../shared/MessageChrome.tsx";
import { DiffConfirmCard } from "../confirm/DiffConfirmCard.tsx";
import { buildMessageTimerText, StatusLine, WelcomeCard } from "./MessageDecorations.tsx";
import { AIBlockRow, MessageBlockView, TaskUpdateView } from "./MessageBlockView.tsx";
import type { MessageListRenderItem } from "./render-item-types.ts";

/** 渲染项组件属性 */
export interface MessageItemViewProps {
  /** 当前渲染项 */
  item: MessageListRenderItem;
}

/** 单个扁平渲染项组件 */
export const MessageItemView: React.FC<MessageItemViewProps> = ({ item }) => {
  if (item.kind === "welcome") {
    return (
      <WelcomeCard
        modelId={item.modelId}
        version={item.version}
        hasProjectRules={item.hasProjectRules}
      />
    );
  }

  if (item.kind === "user") {
    return <UserBubble content={item.message.content} />;
  }

  if (item.kind === "ai_block") {
    return (
      <AssistantSection>
        <MessageBlockView block={item.block} isStreaming={item.isStreaming} />
      </AssistantSection>
    );
  }

  if (item.kind === "ai_task_update") {
    return <AssistantSection><TaskUpdateView item={item} /></AssistantSection>;
  }

  if (item.kind === "ai_diff") {
    return (
      <AssistantSection>
        <AIBlockRow>
          <DiffConfirmCard
            change={item.pendingChange}
            editorOpened={item.diffEditorOpened}
          />
        </AIBlockRow>
      </AssistantSection>
    );
  }

  if (item.isPaused) {
    return null;
  }

  if (!item.isRunning && typeof item.message.totalDurationMs !== "number") {
    return null;
  }

  return (
    <AssistantSection>
      <AIBlockRow>
        <StatusLine
          thinkingStatus={item.thinkingStatus}
          timerText={buildMessageTimerText(item.message.totalDurationMs)}
        />
      </AIBlockRow>
    </AssistantSection>
  );
};
