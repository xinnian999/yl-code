import { describe, expect, test } from "bun:test";
import type { FileItem } from "@/core/file-scanner.ts";
import {
  applyFileSuggestion,
  deriveComposerSuggestionState,
  getFilteredCommands,
  getWrappedIndex,
} from "./composer-state.ts";

/** 创建测试文件项 */
function createFileItem(
  relativePath: string,
  isDirectory: boolean,
): FileItem {
  return {
    name: relativePath.split("/").at(-1) || relativePath,
    path: `/workspace/${relativePath}`,
    relativePath,
    isDirectory,
  };
}

describe("composer-state", () => {
  test("以 / 开头时展示命令建议", () => {
    const state = deriveComposerSuggestionState("/mo");

    expect(state).toEqual({
      showCommandSuggestions: true,
      showFileSuggestions: false,
      showSkillSuggestions: false,
      fileFilter: "",
      atStartIndex: -1,
      skillFilter: "",
      skillStartIndex: -1,
    });
    expect(getFilteredCommands("/mo").some((command) => command.value === "model"))
      .toBe(true);
  });

  test("存在 @ 路径时展示文件建议", () => {
    const state = deriveComposerSuggestionState("查看 @src/cli");

    expect(state.showCommandSuggestions).toBe(false);
    expect(state.showFileSuggestions).toBe(true);
    expect(state.showSkillSuggestions).toBe(false);
    expect(state.fileFilter).toBe("src/cli");
    expect(state.atStartIndex).toBe(3);
  });

  test("存在 $ 技能名时展示技能建议", () => {
    const state = deriveComposerSuggestionState("使用 $find");

    expect(state.showCommandSuggestions).toBe(false);
    expect(state.showFileSuggestions).toBe(false);
    expect(state.showSkillSuggestions).toBe(true);
    expect(state.skillFilter).toBe("find");
    expect(state.skillStartIndex).toBe(3);
  });

  test("目录建议会继续展开，文件建议会结束补全", () => {
    const directoryResult = applyFileSuggestion(
      "查看 @src",
      3,
      createFileItem("src/cli", true),
    );
    const fileResult = applyFileSuggestion(
      "查看 @src/cli",
      3,
      createFileItem("src/cli/App.tsx", false),
    );

    expect(directoryResult).toEqual({
      nextInputValue: "查看 @src/cli/",
      nextFileFilter: "src/cli/",
      nextAtStartIndex: 3,
      keepSuggestionsOpen: true,
    });
    expect(fileResult).toEqual({
      nextInputValue: "查看 @src/cli/App.tsx ",
      nextFileFilter: "",
      nextAtStartIndex: -1,
      keepSuggestionsOpen: false,
    });
  });

  test("循环索引会在边界处回绕", () => {
    expect(getWrappedIndex(0, 3, "up")).toBe(2);
    expect(getWrappedIndex(2, 3, "down")).toBe(0);
  });
});
