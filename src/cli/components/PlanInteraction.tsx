import React from "react";
import PlanQuestionPrompt from "./PlanQuestionPrompt.tsx";
import PlanPreviewConfirm from "./PlanPreviewConfirm.tsx";
import type { PendingPlanInteraction } from "@/core/plan/plan-bus.ts";

/** 计划交互卡片组件属性 */
interface PlanInteractionProps {
  /** 当前待处理的计划交互 */
  interaction: PendingPlanInteraction;
}

/**
 * 计划交互卡片路由组件
 * 根据交互类型渲染计划问题卡片或计划预览卡片（纯展示）
 */
const PlanInteraction: React.FC<PlanInteractionProps> = ({ interaction }) => {
  if (interaction.type === "question") {
    return <PlanQuestionPrompt interaction={interaction} />;
  }

  return <PlanPreviewConfirm interaction={interaction} />;
};

export default PlanInteraction;
