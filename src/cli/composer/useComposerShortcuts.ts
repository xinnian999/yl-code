import type { Dispatch, SetStateAction } from "react";
import { useInput } from "ink";
import type { FileItem } from "@/core/file-scanner.ts";
import type { ComposerSuggestionState } from "./composer-state.ts";
import {
  applyFileSuggestion,
  deriveComposerSuggestionState,
  getWrappedIndex,
} from "./composer-state.ts";

/** 组合输入快捷键上下文 */
export interface UseComposerShortcutsOptions {
  /** 是否正在处理中 */
  isProcessing: boolean;
  /** 是否有覆盖面板 */
  hasOverlay: boolean;
  /** 当前输入值 */
  inputValue: string;
  /** 输入建议状态 */
  suggestionState: ComposerSuggestionState;
  /** 命令建议列表 */
  commandItems: Array<{ value: string; description: string }>;
  /** 命令选中索引 */
  commandSelectedIndex: number;
  /** 文件建议列表 */
  fileItems: FileItem[];
  /** 文件选中索引 */
  fileSelectedIndex: number;
  /** 更新输入值 */
  setInputValue: (value: string) => void;
  /** 更新命令选中索引 */
  setCommandSelectedIndex: Dispatch<SetStateAction<number>>;
  /** 更新文件选中索引 */
  setFileSelectedIndex: Dispatch<SetStateAction<number>>;
  /** 更新建议状态 */
  setSuggestionState: Dispatch<SetStateAction<ComposerSuggestionState>>;
  /** 递增输入组件 key */
  bumpInputKey: () => void;
  /** 取消文件建议 */
  clearFileSuggestions: () => void;
  /** 执行命令 */
  executeCommand: (commandValue: string) => void;
  /** 历史向上 */
  navigateUp: (currentInput: string) => string | null;
  /** 历史向下 */
  navigateDown: () => string | null;
  /** 中断处理 */
  onAbort: () => void;
  /** 切换模式 */
  onModeSwitch: () => void;
}

/** 组合输入区快捷键 hook */
export function useComposerShortcuts(
  options: UseComposerShortcutsOptions,
): void {
  const {
    isProcessing,
    hasOverlay,
    inputValue,
    suggestionState,
    commandItems,
    commandSelectedIndex,
    fileItems,
    fileSelectedIndex,
    setInputValue,
    setCommandSelectedIndex,
    setFileSelectedIndex,
    setSuggestionState,
    bumpInputKey,
    clearFileSuggestions,
    executeCommand,
    navigateUp,
    navigateDown,
    onAbort,
    onModeSwitch,
  } = options;

  useInput(
    (input, key) => {
      if (key.escape && isProcessing) {
        onAbort();
        return;
      }

      if (suggestionState.showFileSuggestions) {
        if (key.upArrow) {
          setFileSelectedIndex((currentIndex) => {
            return getWrappedIndex(currentIndex, fileItems.length, "up");
          });
          return;
        }

        if (key.downArrow) {
          setFileSelectedIndex((currentIndex) => {
            return getWrappedIndex(currentIndex, fileItems.length, "down");
          });
          return;
        }

        if (key.return && fileItems.length > 0) {
          const selected = fileItems[fileSelectedIndex];
          if (!selected) {
            return;
          }

          const result = applyFileSuggestion(
            inputValue,
            suggestionState.atStartIndex,
            selected,
          );
          setInputValue(result.nextInputValue);
          setFileSelectedIndex(0);
          setSuggestionState({
            showCommandSuggestions: false,
            showFileSuggestions: result.keepSuggestionsOpen,
            fileFilter: result.nextFileFilter,
            atStartIndex: result.nextAtStartIndex,
          });
          bumpInputKey();
          return;
        }

        if (key.escape) {
          clearFileSuggestions();
          return;
        }
      }

      if (suggestionState.showCommandSuggestions) {
        if (key.upArrow) {
          setCommandSelectedIndex((currentIndex) => {
            return getWrappedIndex(currentIndex, commandItems.length, "up");
          });
          return;
        }

        if (key.downArrow) {
          setCommandSelectedIndex((currentIndex) => {
            return getWrappedIndex(currentIndex, commandItems.length, "down");
          });
          return;
        }

        if (key.return && commandItems.length > 0) {
          const selected = commandItems[commandSelectedIndex];
          if (selected) {
            executeCommand(selected.value);
          }
          return;
        }

        if (key.escape) {
          setInputValue("");
          setCommandSelectedIndex(0);
          setSuggestionState(deriveComposerSuggestionState(""));
          return;
        }
      }

      if (!isProcessing && !suggestionState.showCommandSuggestions) {
        if (key.upArrow) {
          const nextValue = navigateUp(inputValue);
          if (nextValue !== null) {
            setInputValue(nextValue);
          }
          return;
        }

        if (key.downArrow) {
          const nextValue = navigateDown();
          if (nextValue !== null) {
            setInputValue(nextValue);
          }
          return;
        }
      }

      if (
        key.tab &&
        !suggestionState.showCommandSuggestions &&
        !suggestionState.showFileSuggestions
      ) {
        onModeSwitch();
      }
    },
    {
      isActive: !hasOverlay,
    },
  );
}
