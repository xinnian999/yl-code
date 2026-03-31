import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { SkillSourceConfig } from "./types.ts";

/** 从候选路径中返回首个存在的路径 */
function pickExistingPath(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/** 获取当前模块所在目录 */
function getCurrentModuleDirectory(): string {
  return dirname(fileURLToPath(import.meta.url));
}

/** 解析默认 bundled skills 目录 */
export function resolveBundledSkillsDirectory(): string | null {
  const moduleDirectory = getCurrentModuleDirectory();
  return pickExistingPath([
    join(moduleDirectory, "builtin-skills"),
    join(moduleDirectory, "../../../.agents/skills"),
  ]);
}

/** 解析默认 skills-lock 文件路径 */
export function resolveBundledSkillsLockFile(): string | null {
  const moduleDirectory = getCurrentModuleDirectory();
  return pickExistingPath([
    join(moduleDirectory, "skills-lock.json"),
    join(moduleDirectory, "../../../skills-lock.json"),
  ]);
}

/** 获取默认用户技能目录 */
export function resolveDefaultUserSkillsDirectory(): string {
  return join(homedir(), ".yl", "skills");
}

/** 获取默认技能状态文件路径 */
export function resolveDefaultSkillsStateFile(): string {
  return join(homedir(), ".yl", "skills-state.json");
}

/** 构建技能来源配置列表 */
export function buildSkillSourceConfigs(
  workingDirectory: string,
  userSkillsDirectory: string,
  bundledSkillsDirectory: string | null,
): SkillSourceConfig[] {
  const sources: SkillSourceConfig[] = [
    {
      kind: "workspace_agents",
      directoryPath: join(workingDirectory, ".agents", "skills"),
      readonly: false,
    },
    {
      kind: "workspace_local",
      directoryPath: join(workingDirectory, ".yl", "skills"),
      readonly: false,
    },
    {
      kind: "user",
      directoryPath: userSkillsDirectory,
      readonly: false,
    },
  ];

  if (bundledSkillsDirectory) {
    sources.push({
      kind: "bundled",
      directoryPath: bundledSkillsDirectory,
      readonly: true,
    });
  }

  return sources;
}
