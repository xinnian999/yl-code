import React, { useMemo } from "react";
import { Box } from "ink";
import SelectInput from "ink-select-input";
import type { PendingChange } from "@/core/confirm-bus.ts";
import type { ConfirmResult } from "@/core/types.ts";
import type {
  PendingPlanInteraction,
  PlanPreviewResult,
  PlanQuestionAnswer,
} from "@/core/plan/plan-bus.ts";
import PlanQuestionSelect from "./PlanQuestionSelect.tsx";
import { USER_SURFACE_BACKGROUND_COLOR } from "./ChatSurfaceStyles.ts";

/** 底部确认选择区组件属性 */
interface ConfirmSelectAreaProps {
  /** 是否显示 diff 确认 */
  showDiffConfirm: boolean;
  /** 当前待确认变更 */
  pendingChange: PendingChange | null;
  /** diff 确认回调 */
  onDiffConfirm: (result: ConfirmResult) => void;
  /** 是否显示计划交互 */
  showPlanInteraction: boolean;
  /** 当前待处理的计划交互 */
  pendingPlanInteraction: PendingPlanInteraction | null;
  /** 计划问题回答回调 */
  onPlanQuestionResolve: (answer: PlanQuestionAnswer) => void;
  /** 计划预览结果回调 */
  onPlanPreviewResolve: (result: PlanPreviewResult) => void;
}

/** diff 确认固定选项值类型 */
type DiffAction = ConfirmResult;

/** 计划预览操作值类型 */
type PlanPreviewAction = "execute" | "revise";

/**
 * 底部确认选择区
 * 根据当前活跃的确认类型渲染对应的 SelectInput，替代输入框显示
 */
const ConfirmSelectArea: React.FC<ConfirmSelectAreaProps> = ({
  showDiffConfirm,
  pendingChange,
  onDiffConfirm,
  showPlanInteraction,
  pendingPlanInteraction,
  onPlanQuestionResolve,
  onPlanPreviewResolve,
}) => {
  /** diff/命令确认选项（固定三项） */
  const diffItems = useMemo(() => [
    { label: "同意", value: "accept" as DiffAction },
    { label: "同意且不再询问", value: "accept_all" as DiffAction },
    { label: "拒绝", value: "reject" as DiffAction },
  ], []);

  /** 计划预览选项（固定两项） */
  const planPreviewItems = useMemo(() => [
    { label: "确认执行", value: "execute" as PlanPreviewAction },
    { label: "修改计划", value: "revise" as PlanPreviewAction },
  ], []);

  if (showDiffConfirm && pendingChange) {
    return (
      <Box paddingX={2} paddingY={1} backgroundColor={USER_SURFACE_BACKGROUND_COLOR} width="100%">
        <SelectInput
          items={diffItems}
          onSelect={(item) => onDiffConfirm(item.value)}
        />
      </Box>
    );
  }

  if (showPlanInteraction && pendingPlanInteraction?.type === "preview") {
    return (
      <Box paddingX={2} paddingY={1} backgroundColor={USER_SURFACE_BACKGROUND_COLOR} width="100%">
        <SelectInput
          items={planPreviewItems}
          onSelect={(item) => onPlanPreviewResolve({ action: item.value })}
        />
      </Box>
    );
  }

  if (showPlanInteraction && pendingPlanInteraction?.type === "question") {
    return (
      <Box paddingX={2} paddingY={1} backgroundColor={USER_SURFACE_BACKGROUND_COLOR} width="100%">
        <PlanQuestionSelect
          interaction={pendingPlanInteraction}
          onResolve={onPlanQuestionResolve}
        />
      </Box>
    );
  }

  return null;
};

export default ConfirmSelectArea;
