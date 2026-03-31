import type { SkillIndexEntry } from "./types.ts";

/** 截断过长描述，避免技能索引占用过多上下文 */
function trimSkillDescription(description: string, maxLength = 120): string {
  if (description.length <= maxLength) {
    return description;
  }

  return `${description.slice(0, maxLength).trim()}...`;
}

/** 构建单个技能索引项文本 */
function buildSkillIndexLine(skill: SkillIndexEntry): string {
  const aliasText = skill.aliases.length > 0
    ? ` | aliases: ${skill.aliases.join(", ")}`
    : "";
  const readonlyText = skill.readonly ? " | 内置只读" : "";

  return `- \`${skill.name}\` [${skill.sourceKind}]${readonlyText}: ${trimSkillDescription(skill.description)}${aliasText}`;
}

/** 构建系统提示词中的技能索引段落 */
export function buildSkillsPromptSection(skills: SkillIndexEntry[]): string {
  const enabledSkills = skills.filter((skill) => skill.enabled);
  if (enabledSkills.length === 0) {
    return "";
  }

  return [
    "## 可用 Skills 索引",
    "以下 skills 当前可用。系统只常驻保留它们的索引；如果你判断某个 skill 适合当前任务，应先调用 `get_skills` 读取对应正文，再按技能说明执行。",
    enabledSkills.map(buildSkillIndexLine).join("\n"),
  ].join("\n\n");
}
