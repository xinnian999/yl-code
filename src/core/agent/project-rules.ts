import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** AGENTS 规则文件名 */
const AGENTS_FILE_NAME = "AGENTS.md";

/** YAML frontmatter 的完整匹配规则 */
const YAML_FRONTMATTER_PATTERN = /^---\n[\s\S]*?\n---(?:\n|$)/;

/** 项目规则加载结果 */
export interface ProjectRulesResult {
  /** 命中的 AGENTS 文件路径 */
  filePath: string | null;
  /** 读取并清洗后的规则正文 */
  content: string;
}

/** 统一文本换行符，便于做 frontmatter 解析 */
function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

/** 清理规则正文首尾空白 */
function trimProjectRules(content: string): string {
  return content.trim();
}

/** 判断给定路径是否为可读取的普通文件 */
function isReadableFile(filePath: string): boolean {
  if (!existsSync(filePath)) {
    return false;
  }

  try {
    return statSync(filePath).isFile();
  } catch {
    return false;
  }
}

/** 从当前目录向上查找最近的 AGENTS.md */
export function findNearestAgentsFile(workingDirectory: string): string | null {
  let currentDirectory = resolve(workingDirectory);

  while (true) {
    const candidatePath = join(currentDirectory, AGENTS_FILE_NAME);
    if (isReadableFile(candidatePath)) {
      return candidatePath;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

/** 剥离完整的 YAML frontmatter，未闭合时按普通正文处理 */
export function stripYamlFrontmatter(content: string): string {
  const normalizedContent = normalizeLineEndings(content);
  const matchedFrontmatter = normalizedContent.match(YAML_FRONTMATTER_PATTERN);
  if (!matchedFrontmatter) {
    return trimProjectRules(normalizedContent);
  }

  return trimProjectRules(normalizedContent.slice(matchedFrontmatter[0].length));
}

/** 读取当前项目最近的 AGENTS 规则，失败时按无规则处理 */
export function loadProjectRules(workingDirectory: string): ProjectRulesResult {
  const filePath = findNearestAgentsFile(workingDirectory);
  if (!filePath) {
    return {
      filePath: null,
      content: "",
    };
  }

  try {
    const rawContent = readFileSync(filePath, "utf-8");
    return {
      filePath,
      content: stripYamlFrontmatter(rawContent),
    };
  } catch {
    return {
      filePath,
      content: "",
    };
  }
}

/** 构建注入到 system prompt 的项目规则段落 */
export function buildProjectRulesSection(projectRules: string): string {
  const trimmedRules = trimProjectRules(projectRules);
  if (!trimmedRules) {
    return "";
  }

  return [
    "## 项目规则",
    "以下规则来自当前工作目录最近的 `AGENTS.md`。它们适用于当前项目，应在不违反系统级安全约束的前提下优先遵守。",
    trimmedRules,
  ].join("\n\n");
}
