import { useState, useEffect, useCallback } from "react";
import type { ConfirmBus, PendingChange } from "@/core/confirm-bus.ts";
import { tryOpenDiff, cleanupTempFile, type EditorType } from "@/cli/features/diff/editor-detector.ts";
import type { ConfirmResult } from "@/core/types.ts";

/**
 * Diff 确认状态管理 hook
 * 订阅 confirmBus 事件，管理确认弹窗状态
 */
export function useDiffConfirm(confirmBus: ConfirmBus) {
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

    confirmBus.on("pending-change", handlePendingChange);
    return () => {
      confirmBus.off("pending-change", handlePendingChange);
    };
  }, [confirmBus]);

  const handleDiffConfirm = useCallback(
    (result: ConfirmResult) => {
      if (pendingChange) {
        confirmBus.resolveChange(pendingChange.id, result);
      }

      if (diffTempFile) {
        cleanupTempFile(diffTempFile);
        setDiffTempFile(null);
      }

      setShowDiffConfirm(false);
      setPendingChange(null);
      setDiffEditorOpened(null);
    },
    [pendingChange, diffTempFile, confirmBus]
  );

  return {
    showDiffConfirm,
    pendingChange,
    diffEditorOpened,
    handleDiffConfirm,
  };
}
