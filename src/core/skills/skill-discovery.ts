import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  SkillLockEntry,
  SkillManifest,
  SkillsLockFile,
  SkillSourceConfig,
} from "./types.ts";
import { parseSkillFile } from "./skill-parser.ts";

/** 递归查找技能文件路径 */
export function findSkillFiles(directoryPath: string): string[] {
  if (!existsSync(directoryPath)) {
    return [];
  }

  const results: string[] = [];
  for (const entryName of readdirSync(directoryPath)) {
    const entryPath = join(directoryPath, entryName);
    let stats;
    try {
      stats = statSync(entryPath);
    } catch {
      continue;
    }

    if (stats.isDirectory()) {
      const skillFilePath = join(entryPath, "SKILL.md");
      if (existsSync(skillFilePath)) {
        results.push(skillFilePath);
        continue;
      }

      results.push(...findSkillFiles(entryPath));
    }
  }

  return results.sort();
}

/** 读取技能锁文件 */
export function loadSkillsLockFile(
  filePath: string | null,
): Record<string, SkillLockEntry> {
  if (!filePath || !existsSync(filePath)) {
    return {};
  }

  try {
    const rawContent = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(rawContent) as SkillsLockFile;
    return parsed?.skills ?? {};
  } catch {
    return {};
  }
}

/** 加载单个来源下的技能清单 */
export function loadSkillsFromSource(
  source: SkillSourceConfig,
  lockEntries: Record<string, SkillLockEntry>,
  isEnabled: (skillName: string) => boolean,
): SkillManifest[] {
  const manifests: SkillManifest[] = [];
  const skillFiles = findSkillFiles(source.directoryPath);

  for (const skillFilePath of skillFiles) {
    const parsed = parseSkillFile(skillFilePath);
    if (!parsed) {
      continue;
    }

    manifests.push({
      name: parsed.name,
      description: parsed.description,
      aliases: parsed.aliases,
      content: parsed.content,
      directoryPath: dirname(skillFilePath),
      skillFilePath,
      sourceKind: source.kind,
      readonly: source.readonly,
      enabled: isEnabled(parsed.name),
      lockEntry: source.kind === "bundled" ? lockEntries[parsed.name] ?? null : null,
    });
  }

  return manifests;
}
