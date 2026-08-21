import { describe, expect, test } from "vitest";
import {
  parsePlanInteraction,
  parsePlanInteractionFromToolCalls,
} from "./interaction-parser.ts";

describe("interaction-parser", () => {
  test("能从标签文本中解析计划问题", () => {
    const parsed = parsePlanInteraction(`
<plan_question>
{
  "title": "确认实现范围",
  "question": "这次要只优化 core，还是同时改 CLI？",
  "options": [
    { "label": "只改 core", "description": "保持本轮聚焦" }
  ]
}
</plan_question>
`);

    expect(parsed?.type).toBe("question");
    expect(parsed?.type === "question" ? parsed.data.title : "").toBe("确认实现范围");
  });

  test("能把常见英文计划标题归一化为中文", () => {
    const parsed = parsePlanInteractionFromToolCalls([
      {
        name: "proposed_plan",
        args: {
          title: "优化计划",
          planMarkdown: "# 方案\n## Summary\n- a\n## Test Plan\n- b",
        },
      },
    ]);

    expect(parsed?.type).toBe("preview");
    expect(parsed?.type === "preview" ? parsed.data.planMarkdown.includes("## 概要") : false).toBe(true);
    expect(parsed?.type === "preview" ? parsed.data.planMarkdown.includes("## 测试计划") : false).toBe(true);
  });
});
