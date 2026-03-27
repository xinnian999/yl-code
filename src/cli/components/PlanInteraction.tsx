import React from "react";
import PlanQuestionPrompt from "./PlanQuestionPrompt.tsx";
import PlanPreviewConfirm from "./PlanPreviewConfirm.tsx";
import type {
  PendingPlanInteraction,
  PlanPreviewResult,
  PlanQuestionAnswer,
} from "@/core/plan/plan-bus.ts";

/** 计划交互组件属性 */
interface PlanInteractionProps {
  /** 当前待处理的计划交互 */
  interaction: PendingPlanInteraction;
  /** 处理计划问题回答 */
  onResolveQuestion: (answer: PlanQuestionAnswer) => void;
  /** 处理计划预览结果 */
  onResolvePreview: (result: PlanPreviewResult) => void;
}

/**
 * 计划交互组件
 * 根据交互类型渲染计划问题或计划预览确认面板
 */
const PlanInteraction: React.FC<PlanInteractionProps> = ({
  interaction,
  onResolveQuestion,
  onResolvePreview,
}) => {
  if (interaction.type === "question") {
    return (
      <PlanQuestionPrompt
        interaction={interaction}
        onResolve={onResolveQuestion}
      />
    );
  }

  return (
    <PlanPreviewConfirm
      interaction={interaction}
      onResolve={onResolvePreview}
    />
  );
};

export default PlanInteraction;
