import { useCallback, useState } from "react";
import { loadHistory, saveHistory } from "@/core/history.ts";

/** 输入历史状态 */
export interface InputHistoryState {
  /** 全部历史记录 */
  history: string[];
  /** 当前导航索引 */
  historyIndex: number;
  /** 向上浏览前的暂存输入 */
  tempInput: string;
}

/** 历史导航结果 */
export interface HistoryNavigationResult {
  /** 更新后的历史状态 */
  nextState: InputHistoryState;
  /** 需要写回输入框的值 */
  nextValue: string | null;
}

/** 创建初始输入历史状态 */
export function createInputHistoryState(history: string[]): InputHistoryState {
  return {
    history,
    historyIndex: -1,
    tempInput: "",
  };
}

/** 纯函数方式追加一条历史记录 */
export function appendHistoryEntry(
  history: string[],
  command: string,
): string[] {
  if (history.length > 0 && history[history.length - 1] === command) {
    return history;
  }

  return [...history, command];
}

/** 向上浏览历史记录 */
export function navigateHistoryUpState(
  state: InputHistoryState,
  currentInput: string,
): HistoryNavigationResult {
  if (state.history.length === 0) {
    return { nextState: state, nextValue: null };
  }

  if (state.historyIndex === -1) {
    return {
      nextState: {
        ...state,
        historyIndex: state.history.length - 1,
        tempInput: currentInput,
      },
      nextValue: state.history[state.history.length - 1],
    };
  }

  if (state.historyIndex > 0) {
    const nextIndex = state.historyIndex - 1;
    return {
      nextState: {
        ...state,
        historyIndex: nextIndex,
      },
      nextValue: state.history[nextIndex],
    };
  }

  return { nextState: state, nextValue: null };
}

/** 向下浏览历史记录 */
export function navigateHistoryDownState(
  state: InputHistoryState,
): HistoryNavigationResult {
  if (state.historyIndex === -1) {
    return { nextState: state, nextValue: null };
  }

  if (state.historyIndex < state.history.length - 1) {
    const nextIndex = state.historyIndex + 1;
    return {
      nextState: {
        ...state,
        historyIndex: nextIndex,
      },
      nextValue: state.history[nextIndex],
    };
  }

  return {
    nextState: {
      ...state,
      historyIndex: -1,
    },
    nextValue: state.tempInput,
  };
}

/** 重置历史浏览状态 */
export function resetHistoryNavigationState(
  state: InputHistoryState,
): InputHistoryState {
  return {
    ...state,
    historyIndex: -1,
  };
}

/** 输入历史导航 hook */
export function useInputHistory() {
  const [state, setState] = useState<InputHistoryState>(() => {
    return createInputHistoryState(loadHistory());
  });

  /** 添加新命令到历史记录并持久化 */
  const pushHistory = useCallback((command: string) => {
    setState((currentState) => {
      const nextHistory = appendHistoryEntry(currentState.history, command);
      if (nextHistory !== currentState.history) {
        saveHistory(nextHistory);
      }

      return {
        history: nextHistory,
        historyIndex: -1,
        tempInput: "",
      };
    });
  }, []);

  /** 向上浏览历史记录 */
  const navigateUp = useCallback((currentInput: string): string | null => {
    let nextValue: string | null = null;

    setState((currentState) => {
      const result = navigateHistoryUpState(currentState, currentInput);
      nextValue = result.nextValue;
      return result.nextState;
    });

    return nextValue;
  }, []);

  /** 向下浏览历史记录 */
  const navigateDown = useCallback((): string | null => {
    let nextValue: string | null = null;

    setState((currentState) => {
      const result = navigateHistoryDownState(currentState);
      nextValue = result.nextValue;
      return result.nextState;
    });

    return nextValue;
  }, []);

  /** 重置历史导航索引 */
  const resetNavigation = useCallback(() => {
    setState((currentState) => resetHistoryNavigationState(currentState));
  }, []);

  return { pushHistory, navigateUp, navigateDown, resetNavigation };
}
