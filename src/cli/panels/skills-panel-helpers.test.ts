import { describe, expect, test } from "vitest";
import type { SkillIndexEntry } from "@/core/skills/index.ts";
import {
  buildSkillLabel,
  buildSkillSourceLabel,
} from "./skills-panel-helpers.ts";

/** 创建测试技能项 */
function createSkillEntry(): SkillIndexEntry {
  return {
    name: "find-skills",
    description: "查找技能",
    aliases: [],
    directoryPath: "/tmp/find-skills",
    skillFilePath: "/tmp/find-skills/SKILL.md",
    sourceKind: "bundled",
    readonly: true,
    enabled: true,
    lockEntry: {
      source: "vercel-labs/skills",
      sourceType: "github",
      computedHash: "hash",
    },
  };
}

describe("skills-panel-helpers", () => {
  test("可以构建来源标签与列表标签", () => {
    const skill = createSkillEntry();

    expect(buildSkillSourceLabel(skill)).toContain("vercel-labs/skills");
    expect(buildSkillLabel(skill)).toContain("只读");
    expect(buildSkillLabel(skill)).toContain("启用");
  });
});
