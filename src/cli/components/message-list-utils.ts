import { MessageType, ThinkingStatus } from "@/core/types.ts";
import type { PendingChange } from "@/core/confirm-bus.ts";
import type { EditorType } from "@/core/editor-detector.ts";
import type { AIMessage, Message } from "@/core/message-bus.ts";
import type { ThinkingState } from "@/core/types.ts";
import type { MessageListRenderItem } from "./MessageListRenderTypes.ts";

/** 扁平渲染项构建参数 */
export interface BuildRenderItemsOptions {
  messages: Message[];
  thinkingStatus: ThinkingState;
  streamingBlockIndex: number;
  isProcessing: boolean;
  showDiffConfirm: boolean;
  pendingChange: PendingChange | null;
  diffEditorOpened: EditorType | null;
}

/** 判断当前是否存在活跃思考状态 */
export function isThinkingActive(thinkingStatus: ThinkingState): boolean {
  return thinkingStatus.status !== ThinkingStatus.IDLE;
}

/** 获取最后一条 AI 消息 */
export function getLastAIMessage(messages: Message[]): AIMessage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.type === MessageType.AI) {
      return message as AIMessage;
    }
  }

  return null;
}

/** 构建用于 UI 的扁平渲染项列表 */
export function buildRenderItems(options: BuildRenderItemsOptions): MessageListRenderItem[] {
  const {
    messages,
    thinkingStatus,
    streamingBlockIndex,
    isProcessing,
    showDiffConfirm,
    pendingChange,
    diffEditorOpened,
  } = options;
  const renderItems: MessageListRenderItem[] = [];
  const lastAIMessage = getLastAIMessage(messages);
  const hasActiveThinking = isThinkingActive(thinkingStatus);

  for (const message of messages) {
    if (message.type === MessageType.USER) {
      renderItems.push({
        id: message.id,
        kind: "user",
        message,
        isDynamic: false,
      });
      continue;
    }

    const aiMessage = message as AIMessage;
    const isLastAIMessage = lastAIMessage?.id === aiMessage.id;

    aiMessage.blocks.forEach((block, blockIndex) => {
      const isStreaming = isLastAIMessage && streamingBlockIndex === blockIndex;
      renderItems.push({
        id: `${aiMessage.id}:block:${blockIndex}`,
        kind: "ai_block",
        message: aiMessage,
        block,
        isStreaming,
        isDynamic: isStreaming,
      });
    });

    if (!isLastAIMessage) {
      continue;
    }

    if (hasActiveThinking) {
      renderItems.push({
        id: `${aiMessage.id}:status`,
        kind: "ai_status",
        thinkingStatus,
        isDynamic: true,
      });
    }

    if (showDiffConfirm && pendingChange) {
      renderItems.push({
        id: `${aiMessage.id}:diff`,
        kind: "ai_diff",
        pendingChange,
        diffEditorOpened,
        isDynamic: true,
      });
    }

    if (isProcessing || typeof aiMessage.totalDurationMs === "number") {
      renderItems.push({
        id: `${aiMessage.id}:stats`,
        kind: "ai_stats",
        message: aiMessage,
        isRunning: isProcessing,
        isDynamic: isProcessing || hasActiveThinking || showDiffConfirm,
      });
    }
  }

  return renderItems;
}

/** 计算应当保留在动态区域的尾部项数量 */
export function getDynamicTailCount(items: MessageListRenderItem[]): number {
  let dynamicTailCount = 0;

  for (let index = items.length - 1; index >= 0; index--) {
    if (!items[index].isDynamic) {
      break;
    }

    dynamicTailCount++;
  }

  return dynamicTailCount;
}
