import type { PendingChange } from "@/core/confirm-bus.ts";
import type { EditorType } from "@/core/editor-detector.ts";
import type { AIMessage, Message } from "@/core/message-bus.ts";
import type { ThinkingState } from "@/core/types.ts";
import type { PendingPlanInteraction } from "@/core/plan/plan-bus.ts";

/** AI 文本块渲染项 */
export interface AIBlockRenderItem {
  /** 唯一 ID */
  id: string;
  /** 渲染项类型 */
  kind: "ai_block";
  /** 所属 AI 消息 */
  message: AIMessage;
  /** 当前消息块 */
  block: AIMessage["blocks"][number];
  /** 是否处于流式输出 */
  isStreaming: boolean;
  /** 是否为动态尾部 */
  isDynamic: boolean;
}

/** AI 任务更新渲染项 */
export interface AITaskUpdateRenderItem {
  /** 唯一 ID */
  id: string;
  /** 渲染项类型 */
  kind: "ai_task_update";
  /** 所属 AI 消息 */
  message: AIMessage;
  /** 工具块 */
  toolBlock: Extract<AIMessage["blocks"][number], { type: "tool" }>;
  /** Todo 块 */
  todoBlock: Extract<AIMessage["blocks"][number], { type: "todo" }>;
  /** 是否为动态尾部 */
  isDynamic: boolean;
}

/** AI diff 渲染项 */
export interface AIDiffRenderItem {
  /** 唯一 ID */
  id: string;
  /** 渲染项类型 */
  kind: "ai_diff";
  /** 待确认变更 */
  pendingChange: PendingChange;
  /** 已打开的 diff 编辑器 */
  diffEditorOpened: EditorType | null;
  /** 是否为动态尾部 */
  isDynamic: boolean;
}

/** AI 状态栏渲染项 */
export interface AIStatsRenderItem {
  /** 唯一 ID */
  id: string;
  /** 渲染项类型 */
  kind: "ai_stats";
  /** 所属 AI 消息 */
  message: AIMessage;
  /** 当前思考状态 */
  thinkingStatus: ThinkingState;
  /** 是否仍在运行 */
  isRunning: boolean;
  /** 是否暂停展示 */
  isPaused: boolean;
  /** 是否为动态尾部 */
  isDynamic: boolean;
}

/** 欢迎卡片渲染项 */
export interface WelcomeRenderItem {
  /** 唯一 ID */
  id: string;
  /** 渲染项类型 */
  kind: "welcome";
  /** 当前模型 ID */
  modelId: string;
  /** 应用版本号 */
  version: string;
  /** 是否存在项目规则文件 */
  hasProjectRules: boolean;
  /** 是否为动态尾部 */
  isDynamic: false;
}

/** 用户消息渲染项 */
export interface UserRenderItem {
  /** 唯一 ID */
  id: string;
  /** 渲染项类型 */
  kind: "user";
  /** 用户消息 */
  message: Extract<Message, { type: "user" }>;
  /** 是否为动态尾部 */
  isDynamic: false;
}

/** 扁平消息渲染项 */
export type MessageListRenderItem =
  | WelcomeRenderItem
  | UserRenderItem
  | AIBlockRenderItem
  | AITaskUpdateRenderItem
  | AIDiffRenderItem
  | AIStatsRenderItem;

/** 扁平渲染项构建参数 */
export interface BuildRenderItemsOptions {
  /** 全部消息 */
  messages: Message[];
  /** 当前思考状态 */
  thinkingStatus: ThinkingState;
  /** 当前流式输出块索引 */
  streamingBlockIndex: number;
  /** 是否正在处理 */
  isProcessing: boolean;
  /** 当前待确认变更 */
  pendingChange: PendingChange | null;
  /** 已打开的 diff 编辑器 */
  diffEditorOpened: EditorType | null;
  /** 当前待处理的计划交互 */
  pendingPlanInteraction: PendingPlanInteraction | null;
  /** 欢迎卡片模型 ID */
  modelId: string;
  /** 欢迎卡片版本号 */
  version: string;
  /** 欢迎卡片是否显示项目规则 */
  hasProjectRules: boolean;
}
