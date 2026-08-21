import { describe, expect, test } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  buildProjectRulesSection,
  findNearestAgentsFile,
  loadProjectRules,
  stripYamlFrontmatter,
} from "./project-rules.ts";

/** 创建临时工作目录 */
function createTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "yl-agents-rules-"));
}

/** 清理临时工作目录 */
function cleanupTempWorkspace(workspacePath: string): void {
  rmSync(workspacePath, { recursive: true, force: true });
}

/** 在临时工作目录中写入文件 */
function writeWorkspaceFile(
  workspacePath: string,
  relativePath: string,
  content: string
): string {
  const filePath = join(workspacePath, relativePath);
  mkdirSync(join(filePath, ".."), { recursive: true });
  writeFileSync(filePath, content, "utf-8");
  return filePath;
}

/** 在临时工作目录中创建目录 */
function createWorkspaceDirectory(
  workspacePath: string,
  relativePath: string
): string {
  const directoryPath = join(workspacePath, relativePath);
  mkdirSync(directoryPath, { recursive: true });
  return directoryPath;
}

describe("project-rules", () => {
  test("当前目录存在 AGENTS.md 时会读取正文", () => {
    const workspacePath = createTempWorkspace();

    try {
      const agentsPath = writeWorkspaceFile(
        workspacePath,
        "AGENTS.md",
        "1. 使用 bun\n2. 保持中文注释"
      );
      const result = loadProjectRules(workspacePath);

      expect(result.filePath).toBe(agentsPath);
      expect(result.content).toBe("1. 使用 bun\n2. 保持中文注释");
    } finally {
      cleanupTempWorkspace(workspacePath);
    }
  });

  test("当前目录没有 AGENTS.md 时会向上命中最近一份", () => {
    const workspacePath = createTempWorkspace();

    try {
      const nestedDirectory = createWorkspaceDirectory(workspacePath, "apps/cli");
      const agentsPath = writeWorkspaceFile(
        workspacePath,
        "AGENTS.md",
        "根目录规则"
      );

      expect(findNearestAgentsFile(nestedDirectory)).toBe(agentsPath);
      expect(loadProjectRules(nestedDirectory).content).toBe("根目录规则");
    } finally {
      cleanupTempWorkspace(workspacePath);
    }
  });

  test("多级目录同时存在 AGENTS.md 时只取最近一份", () => {
    const workspacePath = createTempWorkspace();

    try {
      writeWorkspaceFile(workspacePath, "AGENTS.md", "根目录规则");
      const packageDirectory = createWorkspaceDirectory(workspacePath, "packages/demo");
      const nearestPath = writeWorkspaceFile(
        workspacePath,
        "packages/demo/AGENTS.md",
        "子目录规则"
      );

      expect(findNearestAgentsFile(packageDirectory)).toBe(nearestPath);
      expect(loadProjectRules(packageDirectory).content).toBe("子目录规则");
    } finally {
      cleanupTempWorkspace(workspacePath);
    }
  });

  test("会剥离完整 YAML frontmatter，只保留正文", () => {
    const content = [
      "---",
      "alwaysApply: true",
      "scope: project",
      "---",
      "",
      "1. 使用 bun",
      "2. 保持 core 独立",
    ].join("\n");

    expect(stripYamlFrontmatter(content)).toBe(
      "1. 使用 bun\n2. 保持 core 独立"
    );
  });

  test("frontmatter 不完整时不会报错，会按普通正文处理", () => {
    const content = [
      "---",
      "alwaysApply: true",
      "1. 这其实不是完整 frontmatter",
    ].join("\n");

    expect(stripYamlFrontmatter(content)).toBe(content);
  });

  test("没有可用 AGENTS.md 时返回空规则段落", () => {
    const workspacePath = createTempWorkspace();

    try {
      createWorkspaceDirectory(workspacePath, "AGENTS.md");
      const result = loadProjectRules(workspacePath);

      expect(result.content).toBe("");
      expect(buildProjectRulesSection(result.content)).toBe("");
    } finally {
      cleanupTempWorkspace(workspacePath);
    }
  });
});
