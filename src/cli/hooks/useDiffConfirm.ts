import { useState, useEffect, useCallback } from "react";
import type { PendingChange } from "@/core/confirm-bus.ts";
import { tryOpenDiff, cleanupTempFile, type EditorType } from "@/core/editor-detector.ts";
import type { ConfirmResult } from "@/core/types.ts";
import type { Agent } from "@/core/agent.ts";

/**
 * Diff 确认状态管理 hook
 * 订阅 agent 确认事件，管理确认弹窗状态
 */
export function useDiffConfirm(agent: Agent) {
  const [showDiffConfirm, setShowDiffConfirm] = useState(false);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [diffEditorOpened, setDiffEditorOpened] = useState<EditorType | null>(null);
  const [diffTempFile, setDiffTempFile] = useState<string | null>(null);

  useEffect(() => {
    const handlePendingChange = (change: PendingChange) => {
      if (change.type === "file" && change.filePath && change.newContent) {
        const result = tryOpenDiff(change.filePath, change.newContent);
        if (result) {
          setDiffEditorOpened(result.editor);
          setDiffTempFile(result.tempPath);
        } else {
          setDiffEditorOpened(null);
          setDiffTempFile(null);
        }
      } else {
        setDiffEditorOpened(null);
        setDiffTempFile(null);
      }

      setPendingChange(change);
      setShowDiffConfirm(true);
    };

    const { confirmBus } = agent;
    confirmBus.on("pending-change", handlePendingChange);
    return () => {
      confirmBus.off("pending-change", handlePendingChange);
    };
  }, [agent]);

  const handleDiffConfirm = useCallback(
    (result: ConfirmResult) => {
      if (pendingChange) {
        agent.confirmBus.resolveChange(pendingChange.id, result);
      }

      if (diffTempFile) {
        cleanupTempFile(diffTempFile);
        setDiffTempFile(null);
      }

      setShowDiffConfirm(false);
      setPendingChange(null);
      setDiffEditorOpened(null);
    },
    [pendingChange, diffTempFile, agent]
  );

  return {
    showDiffConfirm,
    pendingChange,
    diffEditorOpened,
    handleDiffConfirm,
  };
}
