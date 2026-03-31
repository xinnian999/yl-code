import type { SkillIndexEntry } from "@/core/skills/index.ts";

/** 构建技能来源展示文案 */
export function buildSkillSourceLabel(skill: SkillIndexEntry): string {
  if (skill.sourceKind === "bundled") {
    if (skill.lockEntry) {
      return `内置 | ${skill.lockEntry.sourceType} | ${skill.lockEntry.source}`;
    }

    return "内置";
  }

  if (skill.sourceKind === "user") {
    return "用户目录";
  }

  if (skill.sourceKind === "workspace_local") {
    return "工作区 .yl";
  }

  return "工作区 .agents";
}

/** 构建技能列表项展示文案 */
export function buildSkillLabel(skill: SkillIndexEntry): string {
  const enabledText = skill.enabled ? "启用" : "禁用";
  const readonlyText = skill.readonly ? " | 只读" : "";
  return `${skill.name} | ${enabledText}${readonlyText} | ${buildSkillSourceLabel(skill)}`;
}
