import { commands } from "@/core/commands.ts";
import { extractAtFilter, type FileItem } from "@/core/file-scanner.ts";

/** 输入建议可见性状态 */
export interface ComposerSuggestionState {
  /** 是否展示命令建议 */
  showCommandSuggestions: boolean;
  /** 是否展示文件建议 */
  showFileSuggestions: boolean;
  /** 当前文件过滤词 */
  fileFilter: string;
  /** 当前 @ 的起始索引 */
  atStartIndex: number;
}

/** 选择文件建议后的结果 */
export interface ApplyFileSuggestionResult {
  /** 新的输入值 */
  nextInputValue: string;
  /** 下一轮文件过滤词 */
  nextFileFilter: string;
  /** 下一轮 @ 起始索引 */
  nextAtStartIndex: number;
  /** 是否继续展示文件建议 */
  keepSuggestionsOpen: boolean;
}

/** 根据输入值推导当前建议展示状态 */
export function deriveComposerSuggestionState(
  value: string,
): ComposerSuggestionState {
  if (value.startsWith("/")) {
    return {
      showCommandSuggestions: true,
      showFileSuggestions: false,
      fileFilter: "",
      atStartIndex: -1,
    };
  }

  const atInfo = extractAtFilter(value);
  if (!atInfo) {
    return {
      showCommandSuggestions: false,
      showFileSuggestions: false,
      fileFilter: "",
      atStartIndex: -1,
    };
  }

  return {
    showCommandSuggestions: false,
    showFileSuggestions: true,
    fileFilter: atInfo.filter,
    atStartIndex: atInfo.atIndex,
  };
}

/** 获取过滤后的命令列表 */
export function getFilteredCommands(filter: string) {
  return commands.filter((command) => `/${command.value}`.startsWith(filter));
}

/** 计算循环选择时的下一个索引 */
export function getWrappedIndex(
  currentIndex: number,
  itemCount: number,
  direction: "up" | "down",
): number {
  if (itemCount <= 0) {
    return 0;
  }

  if (direction === "up") {
    return currentIndex > 0 ? currentIndex - 1 : itemCount - 1;
  }

  return currentIndex < itemCount - 1 ? currentIndex + 1 : 0;
}

/** 将文件建议应用到当前输入框内容 */
export function applyFileSuggestion(
  inputValue: string,
  atStartIndex: number,
  selected: FileItem,
): ApplyFileSuggestionResult {
  const beforeAt = inputValue.slice(0, atStartIndex);

  if (selected.isDirectory) {
    const nextFileFilter = `${selected.relativePath}/`;
    return {
      nextInputValue: `${beforeAt}@${nextFileFilter}`,
      nextFileFilter,
      nextAtStartIndex: atStartIndex,
      keepSuggestionsOpen: true,
    };
  }

  return {
    nextInputValue: `${beforeAt}@${selected.relativePath} `,
    nextFileFilter: "",
    nextAtStartIndex: -1,
    keepSuggestionsOpen: false,
  };
}
