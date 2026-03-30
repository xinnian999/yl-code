import { useCallback, useEffect, useMemo, useState } from "react";
import type { PendingChange } from "@/core/confirm-bus.ts";
import type { Agent } from "@/core/agent/Agent.ts";
import {
  cleanupTempFile,
  tryOpenDiff,
  type EditorType,
} from "@/core/editor-detector.ts";
import type { ConfirmResult } from "@/core/types.ts";
import type {
  PendingPlanInteraction,
  PlanPreviewResult,
  PlanQuestionAnswer,
} from "@/core/plan/plan-bus.ts";
import { deriveActiveConfirm } from "./active-confirm.ts";

/** 统一确认态 hook 返回值 */
export interface UseActiveConfirmResult {
  /** 当前统一确认态 */
  activeConfirm: ReturnType<typeof deriveActiveConfirm>;
  /** 当前待处理的计划交互 */
  pendingPlanInteraction: PendingPlanInteraction | null;
  /** 当前待处理的 diff 变更 */
  pendingChange: PendingChange | null;
  /** 处理 diff 确认 */
  handleDiffConfirm: (result: ConfirmResult) => void;
  /** 处理计划问题回答 */
  handlePlanQuestionResolve: (answer: PlanQuestionAnswer) => void;
  /** 处理计划预览结果 */
  handlePlanPreviewResolve: (result: PlanPreviewResult) => void;
}

/** 统一管理 diff 与计划交互确认态 */
export function useActiveConfirm(agent: Agent): UseActiveConfirmResult {
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [diffEditorOpened, setDiffEditorOpened] = useState<EditorType | null>(
    null,
  );
  const [diffTempFiles, setDiffTempFiles] = useState<string[] | null>(null);
  const [pendingPlanInteraction, setPendingPlanInteraction] =
    useState<PendingPlanInteraction | null>(null);

  useEffect(() => {
    /** 处理新的 diff 确认请求 */
    const handlePendingChange = (change: PendingChange) => {
      if (change.type === "file" && change.filePath && change.newContent) {
        const result = tryOpenDiff(change.filePath, change.newContent);
        if (result) {
          setDiffEditorOpened(result.editor);
          setDiffTempFiles(result.tempFiles);
        } else {
          setDiffEditorOpened(null);
          setDiffTempFiles(null);
        }
      } else {
        setDiffEditorOpened(null);
        setDiffTempFiles(null);
      }

      setPendingChange(change);
    };

    /** 处理新的计划交互 */
    const handlePendingInteraction = (interaction: PendingPlanInteraction) => {
      setPendingPlanInteraction(interaction);
    };

    agent.confirmBus.on("pending-change", handlePendingChange);
    agent.planBus.on("pending-interaction", handlePendingInteraction);

    return () => {
      agent.confirmBus.off("pending-change", handlePendingChange);
      agent.planBus.off("pending-interaction", handlePendingInteraction);
    };
  }, [agent]);

  /** 清理 diff 确认相关资源 */
  const clearDiffState = useCallback(() => {
    if (diffTempFiles) {
      diffTempFiles.forEach(cleanupTempFile);
      setDiffTempFiles(null);
    }

    setPendingChange(null);
    setDiffEditorOpened(null);
  }, [diffTempFiles]);

  /** 清理计划交互状态 */
  const clearPlanState = useCallback(() => {
    setPendingPlanInteraction(null);
  }, []);

  /** 处理 diff 确认结果 */
  const handleDiffConfirm = useCallback(
    (result: ConfirmResult) => {
      if (!pendingChange) {
        return;
      }

      agent.confirmBus.resolveChange(pendingChange.id, result);
      clearDiffState();
    },
    [agent, clearDiffState, pendingChange],
  );

  /** 处理计划问题回答 */
  const handlePlanQuestionResolve = useCallback(
    (answer: PlanQuestionAnswer) => {
      if (!pendingPlanInteraction || pendingPlanInteraction.type !== "question") {
        return;
      }

      agent.planBus.resolveInteraction(pendingPlanInteraction.id, answer);
      clearPlanState();
    },
    [agent, clearPlanState, pendingPlanInteraction],
  );

  /** 处理计划预览结果 */
  const handlePlanPreviewResolve = useCallback(
    (result: PlanPreviewResult) => {
      if (!pendingPlanInteraction || pendingPlanInteraction.type !== "preview") {
        return;
      }

      agent.planBus.resolveInteraction(pendingPlanInteraction.id, result);
      clearPlanState();
    },
    [agent, clearPlanState, pendingPlanInteraction],
  );

  /** 当前统一确认态 */
  const activeConfirm = useMemo(() => {
    return deriveActiveConfirm({
      pendingChange,
      diffEditorOpened,
      pendingPlanInteraction,
    });
  }, [diffEditorOpened, pendingChange, pendingPlanInteraction]);

  return {
    activeConfirm,
    pendingPlanInteraction,
    pendingChange,
    handleDiffConfirm,
    handlePlanQuestionResolve,
    handlePlanPreviewResolve,
  };
}
