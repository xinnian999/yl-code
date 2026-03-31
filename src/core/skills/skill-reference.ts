/** 技能引用提示 */
export interface SkillReferenceHint {
  /** 命中的显式技能名称 */
  skillNames: string[];
  /** 附加到模型输入的提示文本 */
  message: string;
}

/** 解析用户输入中的 `$skill-name` 显式引用 */
export function parseSkillReferences(input: string): string[] {
  const references: string[] = [];
  const pattern = /(?:^|\s)\$([a-z0-9-]+)/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(input)) !== null) {
    references.push(match[1]);
  }

  return references;
}

/** 提取输入框里最后一个技能引用过滤词 */
export function extractSkillFilter(
  input: string,
): { skillStartIndex: number; filter: string } | null {
  const lastDollarIndex = input.lastIndexOf("$");
  if (lastDollarIndex === -1) {
    return null;
  }

  if (lastDollarIndex > 0 && input[lastDollarIndex - 1] !== " ") {
    return null;
  }

  const afterDollar = input.slice(lastDollarIndex + 1);
  const spaceIndex = afterDollar.indexOf(" ");
  if (spaceIndex !== -1) {
    return null;
  }

  return {
    skillStartIndex: lastDollarIndex,
    filter: afterDollar,
  };
}

/** 构建显式技能引用的模型提示文本 */
export function buildSkillReferenceHint(
  input: string,
  availableNames: string[],
): SkillReferenceHint | null {
  const referencedNames = parseSkillReferences(input)
    .filter((name) => availableNames.includes(name));
  if (referencedNames.length === 0) {
    return null;
  }

  const uniqueNames = Array.from(new Set(referencedNames));
  return {
    skillNames: uniqueNames,
    message: [
      "【用户显式指定了以下 skills，如适合当前任务，应优先调用 `get_skills` 读取正文】",
      uniqueNames.map((name) => `- ${name}`).join("\n"),
    ].join("\n"),
  };
}
