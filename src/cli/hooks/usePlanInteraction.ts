import { useCallback, useEffect, useState } from "react";
import type {
  PendingPlanInteraction,
  PlanPreviewResult,
  PlanQuestionAnswer,
} from "@/core/plan/plan-bus.ts";
import type { Agent } from "@/core/agent.ts";

/**
 * 计划交互状态管理 hook
 * 订阅计划交互总线，驱动计划问题与计划预览弹层
 */
export function usePlanInteraction(agent: Agent) {
  const [showPlanInteraction, setShowPlanInteraction] = useState(false);
  const [pendingPlanInteraction, setPendingPlanInteraction] =
    useState<PendingPlanInteraction | null>(null);

  useEffect(() => {
    /** 处理新的计划交互 */
    const handlePendingInteraction = (interaction: PendingPlanInteraction) => {
      setPendingPlanInteraction(interaction);
      setShowPlanInteraction(true);
    };

    const { planBus } = agent;
    planBus.on("pending-interaction", handlePendingInteraction);

    return () => {
      planBus.off("pending-interaction", handlePendingInteraction);
    };
  }, [agent]);

  /** 清空当前计划交互状态 */
  const clearPlanInteraction = useCallback(() => {
    setShowPlanInteraction(false);
    setPendingPlanInteraction(null);
  }, []);

  /** 处理计划问题回答 */
  const handlePlanQuestionResolve = useCallback(
    (answer: PlanQuestionAnswer) => {
      if (!pendingPlanInteraction || pendingPlanInteraction.type !== "question") {
        return;
      }

      agent.planBus.resolveInteraction(pendingPlanInteraction.id, answer);
      clearPlanInteraction();
    },
    [agent, clearPlanInteraction, pendingPlanInteraction]
  );

  /** 处理计划预览结果 */
  const handlePlanPreviewResolve = useCallback(
    (result: PlanPreviewResult) => {
      if (!pendingPlanInteraction || pendingPlanInteraction.type !== "preview") {
        return;
      }

      agent.planBus.resolveInteraction(pendingPlanInteraction.id, result);
      clearPlanInteraction();
    },
    [agent, clearPlanInteraction, pendingPlanInteraction]
  );

  return {
    showPlanInteraction,
    pendingPlanInteraction,
    handlePlanQuestionResolve,
    handlePlanPreviewResolve,
  };
}
