import type { Dispatch, SetStateAction } from "react";
import { useInput } from "ink";
import type { FileItem } from "@/core/file-scanner.ts";
import type { SkillIndexEntry } from "@/core/skills/index.ts";
import type { ComposerSuggestionState } from "./composer-state.ts";
import {
  applyFileSuggestion,
  applySkillSuggestion,
  deriveComposerSuggestionState,
  getWrappedIndex,
} from "./composer-state.ts";
import type { HistoryNavigationResult } from "./useInputHistory.ts";

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
  /** 技能建议列表 */
  skillItems: SkillIndexEntry[];
  /** 技能选中索引 */
  skillSelectedIndex: number;
  /** 更新输入值 */
  setInputValue: (value: string) => void;
  /** 更新命令选中索引 */
  setCommandSelectedIndex: Dispatch<SetStateAction<number>>;
  /** 更新文件选中索引 */
  setFileSelectedIndex: Dispatch<SetStateAction<number>>;
  /** 更新技能选中索引 */
  setSkillSelectedIndex: Dispatch<SetStateAction<number>>;
  /** 更新建议状态 */
  setSuggestionState: Dispatch<SetStateAction<ComposerSuggestionState>>;
  /** 递增输入组件 key */
  bumpInputKey: () => void;
  /** 取消文件建议 */
  clearFileSuggestions: () => void;
  /** 取消技能建议 */
  clearSkillSuggestions: () => void;
  /** 执行命令 */
  executeCommand: (commandValue: string) => void;
  /** 应用历史导航结果 */
  applyHistoryNavigation: (result: HistoryNavigationResult) => void;
  /** 当前是否正在浏览历史记录 */
  isNavigatingHistory: boolean;
  /** 历史向上 */
  navigateUp: (currentInput: string) => HistoryNavigationResult;
  /** 历史向下 */
  navigateDown: () => HistoryNavigationResult;
  /** 中断处理 */
  onAbort: () => void;
  /** 切换模式 */
  onModeSwitch: () => void;
}

/** 判断当前上下键是否应优先用于历史导航 */
export function shouldHandleHistoryNavigation(
  isProcessing: boolean,
  isNavigatingHistory: boolean,
  suggestionState: ComposerSuggestionState,
): boolean {
  if (isProcessing) {
    return false;
  }

  if (isNavigatingHistory) {
    return true;
  }

  return (
    !suggestionState.showCommandSuggestions
    && !suggestionState.showFileSuggestions
    && !suggestionState.showSkillSuggestions
  );
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
    skillItems,
    skillSelectedIndex,
    setInputValue,
    setCommandSelectedIndex,
    setFileSelectedIndex,
    setSkillSelectedIndex,
    setSuggestionState,
    bumpInputKey,
    clearFileSuggestions,
    clearSkillSuggestions,
    executeCommand,
    applyHistoryNavigation,
    isNavigatingHistory,
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

      if (
        shouldHandleHistoryNavigation(
          isProcessing,
          isNavigatingHistory,
          suggestionState,
        )
      ) {
        if (key.upArrow) {
          applyHistoryNavigation(navigateUp(inputValue));
          return;
        }

        if (key.downArrow) {
          applyHistoryNavigation(navigateDown());
          return;
        }
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
            showSkillSuggestions: false,
            fileFilter: result.nextFileFilter,
            atStartIndex: result.nextAtStartIndex,
            skillFilter: "",
            skillStartIndex: -1,
          });
          bumpInputKey();
          return;
        }

        if (key.escape) {
          clearFileSuggestions();
          return;
        }
      }

      if (suggestionState.showSkillSuggestions) {
        if (key.upArrow) {
          setSkillSelectedIndex((currentIndex) => {
            return getWrappedIndex(currentIndex, skillItems.length, "up");
          });
          return;
        }

        if (key.downArrow) {
          setSkillSelectedIndex((currentIndex) => {
            return getWrappedIndex(currentIndex, skillItems.length, "down");
          });
          return;
        }

        if (key.return && skillItems.length > 0) {
          const selectedSkill = skillItems[skillSelectedIndex];
          if (!selectedSkill) {
            return;
          }

          setInputValue(
            applySkillSuggestion(
              inputValue,
              suggestionState.skillStartIndex,
              selectedSkill,
            ),
          );
          setSkillSelectedIndex(0);
          setSuggestionState(deriveComposerSuggestionState(""));
          bumpInputKey();
          return;
        }

        if (key.escape) {
          clearSkillSuggestions();
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

      if (
        key.tab
        && !suggestionState.showCommandSuggestions
        && !suggestionState.showFileSuggestions
        && !suggestionState.showSkillSuggestions
      ) {
        onModeSwitch();
      }
    },
    {
      isActive: !hasOverlay,
    },
  );
}
