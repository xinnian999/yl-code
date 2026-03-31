import { describe, expect, test } from "bun:test";
import { shouldHandleHistoryNavigation } from "./useComposerShortcuts.ts";

describe("useComposerShortcuts", () => {
  test("浏览历史时应优先响应上下键，而不是命令建议", () => {
    expect(
      shouldHandleHistoryNavigation(true, false, {
        showCommandSuggestions: false,
        showFileSuggestions: false,
        showSkillSuggestions: false,
        fileFilter: "",
        atStartIndex: -1,
        skillFilter: "",
        skillStartIndex: -1,
      }),
    ).toBe(false);

    expect(
      shouldHandleHistoryNavigation(false, true, {
        showCommandSuggestions: true,
        showFileSuggestions: false,
        showSkillSuggestions: false,
        fileFilter: "",
        atStartIndex: -1,
        skillFilter: "",
        skillStartIndex: -1,
      }),
    ).toBe(true);

    expect(
      shouldHandleHistoryNavigation(false, false, {
        showCommandSuggestions: true,
        showFileSuggestions: false,
        showSkillSuggestions: false,
        fileFilter: "",
        atStartIndex: -1,
        skillFilter: "",
        skillStartIndex: -1,
      }),
    ).toBe(false);
  });
});
