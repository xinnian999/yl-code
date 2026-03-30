import type { PendingChange } from "@/core/confirm-bus.ts";
import type { EditorType } from "@/core/editor-detector.ts";
import type {
  PendingPlanInteraction,
  PendingPlanPreview,
  PendingPlanQuestion,
} from "@/core/plan/plan-bus.ts";

/** Diff 确认态 */
export interface DiffActiveConfirm {
  /** 确认态类型 */
  kind: "diff";
  /** 待确认变更 */
  pendingChange: PendingChange;
  /** 已打开的编辑器 */
  diffEditorOpened: EditorType | null;
}

/** 计划问题确认态 */
export interface PlanQuestionActiveConfirm {
  /** 确认态类型 */
  kind: "plan_question";
  /** 当前计划问题 */
  interaction: PendingPlanQuestion;
}

/** 计划预览确认态 */
export interface PlanPreviewActiveConfirm {
  /** 确认态类型 */
  kind: "plan_preview";
  /** 当前计划预览 */
  interaction: PendingPlanPreview;
}

/** 空确认态 */
export interface EmptyActiveConfirm {
  /** 确认态类型 */
  kind: "none";
}

/** 当前激活的确认态 */
export type ActiveConfirm =
  | EmptyActiveConfirm
  | DiffActiveConfirm
  | PlanQuestionActiveConfirm
  | PlanPreviewActiveConfirm;

/** 确认态推导参数 */
export interface DeriveActiveConfirmOptions {
  /** 待确认 diff */
  pendingChange: PendingChange | null;
  /** 已打开的 diff 编辑器 */
  diffEditorOpened: EditorType | null;
  /** 当前计划交互 */
  pendingPlanInteraction: PendingPlanInteraction | null;
}

/** 根据当前等待中的数据推导统一确认态 */
export function deriveActiveConfirm(
  options: DeriveActiveConfirmOptions,
): ActiveConfirm {
  const { pendingChange, diffEditorOpened, pendingPlanInteraction } = options;

  if (pendingChange) {
    return {
      kind: "diff",
      pendingChange,
      diffEditorOpened,
    };
  }

  if (pendingPlanInteraction?.type === "question") {
    return {
      kind: "plan_question",
      interaction: pendingPlanInteraction,
    };
  }

  if (pendingPlanInteraction?.type === "preview") {
    return {
      kind: "plan_preview",
      interaction: pendingPlanInteraction,
    };
  }

  return { kind: "none" };
}

/** 判断当前是否存在激活中的确认态 */
export function hasActiveConfirm(activeConfirm: ActiveConfirm): boolean {
  return activeConfirm.kind !== "none";
}
