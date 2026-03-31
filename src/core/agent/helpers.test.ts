import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { AgentMode } from "../types.ts";
import type { SkillIndexEntry } from "../skills/index.ts";
import { buildSystemPrompt, loadSystemTemplate } from "./helpers.ts";

/** 创建临时工作目录 */
function createTempWorkspace(): string {
  return mkdtempSync(join(tmpdir(), "yl-build-prompt-"));
}

/** 清理临时工作目录 */
function cleanupTempWorkspace(workspacePath: string): void {
  rmSync(workspacePath, { recursive: true, force: true });
}

/** 在工作目录内写入 AGENTS.md 文件 */
function writeAgentsFile(workspacePath: string, content: string): string {
  const agentsPath = join(workspacePath, "AGENTS.md");
  mkdirSync(workspacePath, { recursive: true });
  writeFileSync(agentsPath, content, "utf-8");
  return agentsPath;
}

/** 创建测试技能索引项 */
function createSkillEntry(): SkillIndexEntry {
  return {
    name: "find-skills",
    description: "帮助查找技能",
    aliases: ["discover-skills"],
    directoryPath: "/tmp/find-skills",
    skillFilePath: "/tmp/find-skills/SKILL.md",
    sourceKind: "bundled",
    readonly: true,
    enabled: true,
    lockEntry: null,
  };
}

describe("helpers", () => {
  test("有 AGENTS.md 时会把项目规则注入 prompt", () => {
    const workspacePath = createTempWorkspace();

    try {
      writeAgentsFile(workspacePath, "1. 必须使用 bun");
      const prompt = buildSystemPrompt(
        loadSystemTemplate(),
        AgentMode.BUILD,
        "暂无额外执行状态。",
        workspacePath
      );

      expect(prompt).toContain("## 项目规则");
      expect(prompt).toContain("1. 必须使用 bun");
      expect(prompt).toContain("以下规则来自当前工作目录最近的 `AGENTS.md`");
    } finally {
      cleanupTempWorkspace(workspacePath);
    }
  });

  test("没有 AGENTS.md 时不会注入空的项目规则标题", () => {
    const workspacePath = createTempWorkspace();

    try {
      const prompt = buildSystemPrompt(
        loadSystemTemplate(),
        AgentMode.BUILD,
        "暂无额外执行状态。",
        workspacePath
      );

      expect(prompt).not.toContain("## 项目规则");
    } finally {
      cleanupTempWorkspace(workspacePath);
    }
  });

  test("同一套 prompt 构建链路在文件变更后会重新读取 AGENTS.md", () => {
    const workspacePath = createTempWorkspace();
    const template = loadSystemTemplate();

    try {
      writeAgentsFile(workspacePath, "1. 第一版规则");
      const firstPrompt = buildSystemPrompt(
        template,
        AgentMode.BUILD,
        "暂无额外执行状态。",
        workspacePath
      );

      writeAgentsFile(workspacePath, "1. 第二版规则");
      const secondPrompt = buildSystemPrompt(
        template,
        AgentMode.BUILD,
        "暂无额外执行状态。",
        workspacePath
      );

      expect(firstPrompt).toContain("1. 第一版规则");
      expect(secondPrompt).toContain("1. 第二版规则");
      expect(secondPrompt).not.toContain("1. 第一版规则");
    } finally {
      cleanupTempWorkspace(workspacePath);
    }
  });

  test("有可用 skills 时会把技能索引注入 prompt", () => {
    const workspacePath = createTempWorkspace();

    try {
      const prompt = buildSystemPrompt(
        loadSystemTemplate(),
        AgentMode.BUILD,
        "暂无额外执行状态。",
        workspacePath,
        [createSkillEntry()],
      );

      expect(prompt).toContain("## 可用 Skills 索引");
      expect(prompt).toContain("find-skills");
      expect(prompt).toContain("get_skills");
    } finally {
      cleanupTempWorkspace(workspacePath);
    }
  });
});
