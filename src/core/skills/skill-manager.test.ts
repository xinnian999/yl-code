import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { SkillManager } from "./skill-manager.ts";

/** 创建临时目录 */
function createTempDirectory(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

/** 清理临时目录 */
function cleanupTempDirectory(directoryPath: string): void {
  rmSync(directoryPath, { recursive: true, force: true });
}

/** 写入技能文件 */
function writeSkillFile(
  rootDirectory: string,
  relativeDirectory: string,
  name: string,
  description: string,
): string {
  const skillDirectory = join(rootDirectory, relativeDirectory, name);
  mkdirSync(skillDirectory, { recursive: true });
  const filePath = join(skillDirectory, "SKILL.md");
  writeFileSync(filePath, [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    "---",
    "",
    `# ${name}`,
    "",
    `${description} 正文`,
  ].join("\n"));
  return filePath;
}

/** 写入技能锁文件 */
function writeSkillsLockFile(filePath: string): void {
  writeFileSync(filePath, JSON.stringify({
    version: 1,
    skills: {
      "create-skills": {
        source: "yl-code",
        sourceType: "builtin",
        computedHash: "hash-create",
      },
    },
  }, null, 2));
}

describe("skill-manager", () => {
  test("会按来源优先级覆盖同名技能，并标记 bundled 为只读", () => {
    const workspacePath = createTempDirectory("yl-skill-workspace-");
    const userSkillsPath = createTempDirectory("yl-skill-user-");
    const bundledSkillsPath = createTempDirectory("yl-skill-bundled-");
    const stateFilePath = join(createTempDirectory("yl-skill-state-"), "skills-state.json");
    const lockFilePath = join(createTempDirectory("yl-skill-lock-"), "skills-lock.json");

    try {
      writeSkillFile(workspacePath, ".agents/skills", "shared-skill", "workspace agents");
      writeSkillFile(workspacePath, ".yl/skills", "local-skill", "workspace local");
      writeSkillFile(userSkillsPath, "", "shared-skill", "user shared");
      writeSkillFile(bundledSkillsPath, "", "create-skills", "bundled create");
      writeSkillFile(bundledSkillsPath, "", "shared-skill", "bundled shared");
      writeSkillsLockFile(lockFilePath);

      const manager = new SkillManager({
        workingDirectory: workspacePath,
        userSkillsDirectory: userSkillsPath,
        bundledSkillsDirectory: bundledSkillsPath,
        skillsLockFilePath: lockFilePath,
        stateFilePath,
      });

      const skills = manager.getSkills();
      const sharedSkill = skills.find((skill) => skill.name === "shared-skill");
      const bundledSkill = skills.find((skill) => skill.name === "create-skills");

      expect(sharedSkill?.sourceKind).toBe("workspace_agents");
      expect(sharedSkill?.description).toBe("workspace agents");
      expect(bundledSkill?.sourceKind).toBe("bundled");
      expect(bundledSkill?.readonly).toBe(true);
      expect(bundledSkill?.lockEntry?.source).toBe("yl-code");
    } finally {
      cleanupTempDirectory(workspacePath);
      cleanupTempDirectory(userSkillsPath);
      cleanupTempDirectory(bundledSkillsPath);
      cleanupTempDirectory(dirname(stateFilePath));
      cleanupTempDirectory(dirname(lockFilePath));
    }
  });

  test("切换技能状态后会持久化到状态文件", () => {
    const workspacePath = createTempDirectory("yl-skill-workspace-");
    const userSkillsPath = createTempDirectory("yl-skill-user-");
    const bundledSkillsPath = createTempDirectory("yl-skill-bundled-");
    const stateDirectory = createTempDirectory("yl-skill-state-");
    const stateFilePath = join(stateDirectory, "skills-state.json");

    try {
      writeSkillFile(workspacePath, ".agents/skills", "workspace-skill", "workspace skill");
      writeSkillFile(bundledSkillsPath, "", "bundled-skill", "bundled skill");

      const manager = new SkillManager({
        workingDirectory: workspacePath,
        userSkillsDirectory: userSkillsPath,
        bundledSkillsDirectory: bundledSkillsPath,
        skillsLockFilePath: null,
        stateFilePath,
      });

      manager.toggleSkill("workspace-skill");
      manager.toggleSkill("bundled-skill");

      const reloadedManager = new SkillManager({
        workingDirectory: workspacePath,
        userSkillsDirectory: userSkillsPath,
        bundledSkillsDirectory: bundledSkillsPath,
        skillsLockFilePath: null,
        stateFilePath,
      });

      expect(
        reloadedManager.getSkills().find((skill) => skill.name === "workspace-skill")?.enabled,
      ).toBe(false);
      expect(
        reloadedManager.getSkills().find((skill) => skill.name === "bundled-skill")?.enabled,
      ).toBe(false);
    } finally {
      cleanupTempDirectory(workspacePath);
      cleanupTempDirectory(userSkillsPath);
      cleanupTempDirectory(bundledSkillsPath);
      cleanupTempDirectory(stateDirectory);
    }
  });

  test("getSkillsToolResult 会返回正文并处理禁用与未知技能", () => {
    const workspacePath = createTempDirectory("yl-skill-workspace-");
    const userSkillsPath = createTempDirectory("yl-skill-user-");
    const bundledSkillsPath = createTempDirectory("yl-skill-bundled-");
    const stateDirectory = createTempDirectory("yl-skill-state-");
    const stateFilePath = join(stateDirectory, "skills-state.json");

    try {
      writeSkillFile(bundledSkillsPath, "", "create-skills", "bundled create");
      writeSkillFile(workspacePath, ".agents/skills", "workspace-skill", "workspace skill");

      const manager = new SkillManager({
        workingDirectory: workspacePath,
        userSkillsDirectory: userSkillsPath,
        bundledSkillsDirectory: bundledSkillsPath,
        skillsLockFilePath: null,
        stateFilePath,
      });

      manager.toggleSkill("create-skills");
      const result = manager.getSkillsToolResult([
        "workspace-skill",
        "create-skills",
        "missing-skill",
      ]);

      expect(result).toContain("=== SKILL: workspace-skill ===");
      expect(result).toContain("技能已禁用，无法读取: create-skills");
      expect(result).toContain("未找到技能: missing-skill");
    } finally {
      cleanupTempDirectory(workspacePath);
      cleanupTempDirectory(userSkillsPath);
      cleanupTempDirectory(bundledSkillsPath);
      cleanupTempDirectory(stateDirectory);
    }
  });
});
