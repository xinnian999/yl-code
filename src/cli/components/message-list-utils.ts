import { MessageType, ThinkingStatus } from "@/core/types.ts";
import type { PendingChange } from "@/core/confirm-bus.ts";
import type { EditorType } from "@/core/editor-detector.ts";
import type { AIMessage, Message } from "@/core/message-bus.ts";
import type { ThinkingState } from "@/core/types.ts";
import type { PendingPlanInteraction } from "@/core/plan/plan-bus.ts";
import type { MessageListRenderItem } from "./MessageListRenderTypes.ts";

/** 空闲态思考状态，供历史统计行复用 */
const IDLE_THINKING_STATE: ThinkingState = {
  status: ThinkingStatus.IDLE,
  detail: "",
};

/** 判断工具块是否表示任务列表更新 */
function isTaskUpdateToolBlock(content: string): boolean {
  return content.trimStart().startsWith("更新任务列表");
}

/** 扁平渲染项构建参数 */
export interface BuildRenderItemsOptions {
  messages: Message[];
  thinkingStatus: ThinkingState;
  streamingBlockIndex: number;
  isProcessing: boolean;
  showDiffConfirm: boolean;
  pendingChange: PendingChange | null;
  diffEditorOpened: EditorType | null;
  /** 当前待处理的计划交互（用于渲染计划卡片） */
  pendingPlanInteraction: PendingPlanInteraction | null;
  /** 欢迎卡片：当前模型 ID */
  modelId: string;
  /** 欢迎卡片：应用版本号 */
  version: string;
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

/** 判断指定 AI 消息是否需要显示统计信息 */
function shouldRenderStatsForMessage(
  message: AIMessage,
  isLastAIMessage: boolean,
  isProcessing: boolean,
  hasActiveThinking: boolean,
  showDiffConfirm: boolean
): boolean {
  if (typeof message.totalDurationMs === "number") {
    return true;
  }

  if (!isLastAIMessage) {
    return false;
  }

  return isProcessing || hasActiveThinking || showDiffConfirm;
}

/** 为统计行生成对应的思考状态 */
function getStatsThinkingState(
  isLastAIMessage: boolean,
  thinkingStatus: ThinkingState
): ThinkingState {
  if (isLastAIMessage) {
    return thinkingStatus;
  }

  return IDLE_THINKING_STATE;
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
    pendingPlanInteraction,
    modelId,
    version,
  } = options;
  const renderItems: MessageListRenderItem[] = [
    { id: "welcome", kind: "welcome", modelId, version, isDynamic: false },
  ];
  const lastAIMessage = getLastAIMessage(messages);
  const hasActiveThinking = isThinkingActive(thinkingStatus);
  const shouldPauseThinkingStatus = Boolean(showDiffConfirm && pendingChange);
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

    for (let blockIndex = 0; blockIndex < aiMessage.blocks.length; blockIndex++) {
      const block = aiMessage.blocks[blockIndex];
      const isStreaming = isLastAIMessage && streamingBlockIndex === blockIndex;

      const nextBlock = aiMessage.blocks[blockIndex + 1];

      if (
        block.type === "tool" &&
        nextBlock?.type === "todo" &&
        isTaskUpdateToolBlock(block.content)
      ) {
        renderItems.push({
          id: `${aiMessage.id}:task-update:${blockIndex}`,
          kind: "ai_task_update",
          message: aiMessage,
          toolBlock: block,
          todoBlock: nextBlock,
          isDynamic: false,
        });
        blockIndex++;
        continue;
      }

      renderItems.push({
        id: `${aiMessage.id}:block:${blockIndex}`,
        kind: "ai_block",
        message: aiMessage,
        block,
        isStreaming,
        isDynamic: isStreaming,
      });
    }

    if (isLastAIMessage && showDiffConfirm && pendingChange) {
      renderItems.push({
        id: `${aiMessage.id}:diff`,
        kind: "ai_diff",
        pendingChange,
        diffEditorOpened,
        isDynamic: false,
      });
    }

    if (isLastAIMessage && pendingPlanInteraction) {
      renderItems.push({
        id: `${aiMessage.id}:plan-card:${pendingPlanInteraction.type}`,
        kind: "ai_plan_interaction",
        interaction: pendingPlanInteraction,
        isDynamic: false,
      });
    }

    if (shouldRenderStatsForMessage(
      aiMessage,
      isLastAIMessage,
      isProcessing,
      hasActiveThinking,
      showDiffConfirm,
    )) {
      renderItems.push({
        id: `${aiMessage.id}:stats`,
        kind: "ai_stats",
        message: aiMessage,
        thinkingStatus: getStatsThinkingState(isLastAIMessage, thinkingStatus),
        isRunning: isLastAIMessage && isProcessing,
        isPaused: isLastAIMessage && shouldPauseThinkingStatus,
        isDynamic: isLastAIMessage && (isProcessing || hasActiveThinking || showDiffConfirm),
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
