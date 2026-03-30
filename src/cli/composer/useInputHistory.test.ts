import { describe, expect, test } from "bun:test";
import {
  appendHistoryEntry,
  createInputHistoryState,
  navigateHistoryDownState,
  navigateHistoryUpState,
  resetHistoryNavigationState,
} from "./useInputHistory.ts";

describe("useInputHistory helpers", () => {
  test("追加历史时会避免连续重复", () => {
    expect(appendHistoryEntry(["/model"], "/model")).toEqual(["/model"]);
    expect(appendHistoryEntry(["/model"], "/history")).toEqual([
      "/model",
      "/history",
    ]);
  });

  test("上下浏览会在历史和暂存输入之间切换", () => {
    const initialState = createInputHistoryState(["第一条", "第二条"]);
    const upResult = navigateHistoryUpState(initialState, "临时输入");
    const secondUpResult = navigateHistoryUpState(upResult.nextState, "忽略");
    const downResult = navigateHistoryDownState(secondUpResult.nextState);
    const finalDownResult = navigateHistoryDownState(downResult.nextState);

    expect(upResult.nextValue).toBe("第二条");
    expect(secondUpResult.nextValue).toBe("第一条");
    expect(downResult.nextValue).toBe("第二条");
    expect(finalDownResult.nextValue).toBe("临时输入");
    expect(resetHistoryNavigationState(finalDownResult.nextState).historyIndex).toBe(
      -1,
    );
  });
});
