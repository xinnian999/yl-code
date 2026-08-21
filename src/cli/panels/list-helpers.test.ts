import { describe, expect, test } from "vitest";
import {
  clampSelectedIndex,
  getNextSelectedIndex,
} from "./list-helpers.ts";

describe("list-helpers", () => {
  test("列表导航会在边界处停止", () => {
    expect(getNextSelectedIndex(0, 3, "up")).toBe(0);
    expect(getNextSelectedIndex(1, 3, "up")).toBe(0);
    expect(getNextSelectedIndex(1, 3, "down")).toBe(2);
    expect(getNextSelectedIndex(2, 3, "down")).toBe(2);
  });

  test("裁剪索引会处理空列表和越界", () => {
    expect(clampSelectedIndex(5, 0)).toBe(0);
    expect(clampSelectedIndex(5, 2)).toBe(1);
    expect(clampSelectedIndex(1, 2)).toBe(1);
  });
});
