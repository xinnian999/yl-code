import { useState } from "react";
import { loadHistory, addToHistory } from "@/cli/features/history/history.ts";

/**
 * 历史命令管理 hook
 * 管理命令历史和上下键导航
 */
export function useHistory() {
  const [history, setHistory] = useState<string[]>(() => loadHistory());
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState("");

  /** 添加新命令到历史记录并持久化 */
  const pushHistory = (command: string) => {
    const newHistory = addToHistory(history, command);
    setHistory(newHistory);
    setHistoryIndex(-1);
    setTempInput("");
  };

  /** 按上键 */
  const navigateUp = (currentInput: string): string | null => {
    if (history.length === 0) return null;

    if (historyIndex === -1) {
      setTempInput(currentInput);
      setHistoryIndex(history.length - 1);
      return history[history.length - 1];
    }

    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      return history[historyIndex - 1];
    }

    return null;
  };

  /** 按下键 */
  const navigateDown = (): string | null => {
    if (historyIndex === -1) return null;

    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      return history[historyIndex + 1];
    }

    setHistoryIndex(-1);
    return tempInput;
  };

  /** 重置历史导航索引 */
  const resetNavigation = () => {
    setHistoryIndex(-1);
  };

  return { pushHistory, navigateUp, navigateDown, resetNavigation };
}
