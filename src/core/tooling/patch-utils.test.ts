import { describe, expect, test } from "vitest";
import { applyPatchWithFallback } from "./patch-utils.ts";

describe("patch-utils", () => {
  test("能应用缺少完整头信息的统一 diff", () => {
    const result = applyPatchWithFallback(
      "line1\nline2\nline3\n",
      "@@ -2,1 +2,1 @@\n-line2\n+line2-updated\n"
    );

    expect(result).toBe("line1\nline2-updated\nline3\n");
  });
});
