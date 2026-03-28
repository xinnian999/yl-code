import type { PendingChange } from "@/core/confirm-bus.ts";
import type { EditorType } from "@/core/editor-detector.ts";
import type { AIMessage, UserMessage } from "@/core/message-bus.ts";
import type { MessageBlock, ThinkingState } from "@/core/types.ts";

/** 任务更新工具块 */
export type TaskUpdateToolBlock = Extract<MessageBlock, { type: "tool" }>;

/** 任务进度快照块 */
export type TaskUpdateTodoBlock = Extract<MessageBlock, { type: "todo" }>;

/** 用户消息渲染项 */
export interface UserRenderItem {
  id: string;
  kind: "user";
  message: UserMessage;
  isDynamic: false;
}

/** AI 内容块渲染项 */
export interface AIBlockRenderItem {
  id: string;
  kind: "ai_block";
  message: AIMessage;
  block: MessageBlock;
  isStreaming: boolean;
  isDynamic: boolean;
}

/** AI 任务更新组合渲染项 */
export interface AITaskUpdateRenderItem {
  id: string;
  kind: "ai_task_update";
  message: AIMessage;
  toolBlock: TaskUpdateToolBlock;
  todoBlock: TaskUpdateTodoBlock;
  isDynamic: boolean;
}

/** AI 变更确认渲染项 */
export interface AIDiffRenderItem {
  id: string;
  kind: "ai_diff";
  pendingChange: PendingChange;
  diffEditorOpened: EditorType | null;
  isDynamic: boolean;
}

/** AI 统计渲染项 */
export interface AIStatsRenderItem {
  id: string;
  kind: "ai_stats";
  message: AIMessage;
  thinkingStatus: ThinkingState;
  isRunning: boolean;
  /** 是否暂停显示 */
  isPaused: boolean;
  isDynamic: boolean;
}

/** 消息列表扁平渲染项 */
export type MessageListRenderItem =
  | UserRenderItem
  | AIBlockRenderItem
  | AITaskUpdateRenderItem
  | AIDiffRenderItem
  | AIStatsRenderItem;
