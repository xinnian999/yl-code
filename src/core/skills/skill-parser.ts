import { readFileSync } from "node:fs";
import type { ParsedSkillDocument } from "./types.ts";

/** YAML frontmatter 的完整匹配规则 */
const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---(?:\n|$)/;

/** 清理 frontmatter 值上的首尾引号 */
function normalizeScalarValue(value: string): string {
  const trimmedValue = value.trim();
  if (
    (trimmedValue.startsWith("\"") && trimmedValue.endsWith("\""))
    || (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    return trimmedValue.slice(1, -1).trim();
  }

  return trimmedValue;
}

/** 解析 skill frontmatter，仅支持顶层字符串与字符串数组 */
function parseFrontmatter(
  rawFrontmatter: string,
): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  let currentArrayKey: string | null = null;

  for (const rawLine of rawFrontmatter.split("\n")) {
    const line = rawLine.trimEnd();
    if (!line.trim()) {
      continue;
    }

    const arrayMatch = line.match(/^\s*-\s+(.+)$/);
    if (arrayMatch && currentArrayKey) {
      const currentValue = result[currentArrayKey];
      const nextValue = normalizeScalarValue(arrayMatch[1]);
      if (Array.isArray(currentValue)) {
        currentValue.push(nextValue);
      }
      continue;
    }

    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      currentArrayKey = null;
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    if (!key) {
      currentArrayKey = null;
      continue;
    }

    if (!value) {
      result[key] = [];
      currentArrayKey = key;
      continue;
    }

    result[key] = normalizeScalarValue(value);
    currentArrayKey = null;
  }

  return result;
}

/** 从 Markdown 内容中提取技能文档 */
export function parseSkillDocument(markdown: string): ParsedSkillDocument | null {
  const normalizedMarkdown = markdown.replace(/\r\n/g, "\n");
  const matchedFrontmatter = normalizedMarkdown.match(FRONTMATTER_PATTERN);
  if (!matchedFrontmatter) {
    return null;
  }

  const metadata = parseFrontmatter(matchedFrontmatter[1]);
  const name = typeof metadata.name === "string" ? metadata.name.trim() : "";
  const description =
    typeof metadata.description === "string"
      ? metadata.description.trim()
      : "";
  const aliases = Array.isArray(metadata.aliases)
    ? metadata.aliases.map((alias) => String(alias).trim()).filter(Boolean)
    : [];

  if (!name || !description) {
    return null;
  }

  return {
    name,
    description,
    aliases,
    content: normalizedMarkdown.slice(matchedFrontmatter[0].length).trim(),
  };
}

/** 直接从 SKILL.md 文件读取并解析技能文档 */
export function parseSkillFile(filePath: string): ParsedSkillDocument | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    return parseSkillDocument(content);
  } catch {
    return null;
  }
}
