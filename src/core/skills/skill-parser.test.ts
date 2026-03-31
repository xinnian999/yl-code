import { describe, expect, test } from "bun:test";
import { parseSkillDocument } from "./skill-parser.ts";

describe("skill-parser", () => {
  test("可以解析 name、description 和 aliases", () => {
    const document = parseSkillDocument([
      "---",
      "name: create-skills",
      "description: 创建 skills 骨架",
      "aliases:",
      "  - make-skill",
      "  - scaffold-skill",
      "---",
      "",
      "# Create Skills",
      "",
      "正文内容",
    ].join("\n"));

    expect(document).not.toBeNull();
    expect(document?.name).toBe("create-skills");
    expect(document?.description).toBe("创建 skills 骨架");
    expect(document?.aliases).toEqual(["make-skill", "scaffold-skill"]);
    expect(document?.content).toContain("# Create Skills");
  });

  test("缺少必填字段时返回 null", () => {
    const document = parseSkillDocument([
      "---",
      "name: incomplete-skill",
      "---",
      "",
      "正文内容",
    ].join("\n"));

    expect(document).toBeNull();
  });
});
