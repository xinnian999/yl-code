import { commands } from "@/core/commands.ts";
import { extractAtFilter, type FileItem } from "@/core/file-scanner.ts";
import {
  extractSkillFilter,
  type SkillIndexEntry,
} from "@/core/skills/index.ts";

/** 输入建议可见性状态 */
export interface ComposerSuggestionState {
  /** 是否展示命令建议 */
  showCommandSuggestions: boolean;
  /** 是否展示文件建议 */
  showFileSuggestions: boolean;
  /** 是否展示技能建议 */
  showSkillSuggestions: boolean;
  /** 当前文件过滤词 */
  fileFilter: string;
  /** 当前 @ 的起始索引 */
  atStartIndex: number;
  /** 当前技能过滤词 */
  skillFilter: string;
  /** 当前 $ 的起始索引 */
  skillStartIndex: number;
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

/** 构建空的建议状态 */
function buildEmptySuggestionState(): ComposerSuggestionState {
  return {
    showCommandSuggestions: false,
    showFileSuggestions: false,
    showSkillSuggestions: false,
    fileFilter: "",
    atStartIndex: -1,
    skillFilter: "",
    skillStartIndex: -1,
  };
}

/** 根据输入值推导当前建议展示状态 */
export function deriveComposerSuggestionState(
  value: string,
): ComposerSuggestionState {
  if (value.startsWith("/")) {
    return {
      ...buildEmptySuggestionState(),
      showCommandSuggestions: true,
    };
  }

  const atInfo = extractAtFilter(value);
  const skillInfo = extractSkillFilter(value);
  if (!atInfo && !skillInfo) {
    return buildEmptySuggestionState();
  }

  if (skillInfo && (!atInfo || skillInfo.skillStartIndex > atInfo.atIndex)) {
    return {
      ...buildEmptySuggestionState(),
      showSkillSuggestions: true,
      skillFilter: skillInfo.filter,
      skillStartIndex: skillInfo.skillStartIndex,
    };
  }

  if (!atInfo) {
    return buildEmptySuggestionState();
  }

  return {
    ...buildEmptySuggestionState(),
    showFileSuggestions: true,
    fileFilter: atInfo.filter,
    atStartIndex: atInfo.atIndex,
  };
}

/** 获取过滤后的命令列表 */
export function getFilteredCommands(filter: string) {
  return commands.filter((command) => `/${command.value}`.startsWith(filter));
}

/** 获取过滤后的技能列表 */
export function getFilteredSkills(
  skills: SkillIndexEntry[],
  filter: string,
): SkillIndexEntry[] {
  const normalizedFilter = filter.trim().toLowerCase();
  const enabledSkills = skills.filter((skill) => skill.enabled);

  if (!normalizedFilter) {
    return enabledSkills;
  }

  return enabledSkills.filter((skill) => {
    if (skill.name.toLowerCase().includes(normalizedFilter)) {
      return true;
    }

    return skill.aliases.some((alias) => {
      return alias.toLowerCase().includes(normalizedFilter);
    });
  });
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

/** 将技能建议应用到当前输入框内容 */
export function applySkillSuggestion(
  inputValue: string,
  skillStartIndex: number,
  selectedSkill: SkillIndexEntry,
): string {
  const beforeDollar = inputValue.slice(0, skillStartIndex);
  return `${beforeDollar}$${selectedSkill.name} `;
}
