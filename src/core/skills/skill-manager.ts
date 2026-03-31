import { EventEmitter } from "node:events";
import {
  buildSkillSourceConfigs,
  resolveBundledSkillsDirectory,
  resolveBundledSkillsLockFile,
  resolveDefaultSkillsStateFile,
  resolveDefaultUserSkillsDirectory,
} from "./skill-paths.ts";
import { loadSkillsFromSource, loadSkillsLockFile } from "./skill-discovery.ts";
import { buildSkillsPromptSection } from "./skill-prompt.ts";
import { SkillStateStore } from "./skill-state.ts";
import type { SkillIndexEntry, SkillManifest } from "./types.ts";

/** 技能管理器事件定义 */
interface SkillManagerEvents {
  "skills:change": (skills: SkillIndexEntry[]) => void;
}

/** 技能管理器配置 */
export interface SkillManagerOptions {
  /** 当前工作目录 */
  workingDirectory?: string;
  /** 用户技能目录 */
  userSkillsDirectory?: string;
  /** bundled 技能目录 */
  bundledSkillsDirectory?: string | null;
  /** 技能锁文件路径 */
  skillsLockFilePath?: string | null;
  /** 技能状态文件路径 */
  stateFilePath?: string;
}

/** 技能管理器 */
export class SkillManager extends EventEmitter {
  /** 当前工作目录 */
  private readonly workingDirectory: string;
  /** 用户技能目录 */
  private readonly userSkillsDirectory: string;
  /** bundled 技能目录 */
  private readonly bundledSkillsDirectory: string | null;
  /** 技能锁文件路径 */
  private readonly skillsLockFilePath: string | null;
  /** 技能状态存储 */
  private readonly stateStore: SkillStateStore;
  /** 当前技能清单 */
  private manifests: SkillManifest[] = [];

  constructor(options: SkillManagerOptions = {}) {
    super();
    this.workingDirectory = options.workingDirectory ?? process.cwd();
    this.userSkillsDirectory =
      options.userSkillsDirectory ?? resolveDefaultUserSkillsDirectory();
    this.bundledSkillsDirectory =
      typeof options.bundledSkillsDirectory === "undefined"
        ? resolveBundledSkillsDirectory()
        : options.bundledSkillsDirectory;
    this.skillsLockFilePath =
      typeof options.skillsLockFilePath === "undefined"
        ? resolveBundledSkillsLockFile()
        : options.skillsLockFilePath;
    this.stateStore = new SkillStateStore(
      options.stateFilePath ?? resolveDefaultSkillsStateFile(),
    );
    this.reload();
  }

  /** 重新扫描技能目录 */
  reload(): void {
    const sources = buildSkillSourceConfigs(
      this.workingDirectory,
      this.userSkillsDirectory,
      this.bundledSkillsDirectory,
    );
    const lockEntries = loadSkillsLockFile(this.skillsLockFilePath);
    const resolvedSkills = new Map<string, SkillManifest>();

    for (const source of sources) {
      const skills = loadSkillsFromSource(
        source,
        lockEntries,
        (skillName) => {
          return this.stateStore.getEnabled(
            source.kind,
            this.workingDirectory,
            skillName,
          );
        },
      );

      for (const skill of skills) {
        if (!resolvedSkills.has(skill.name)) {
          resolvedSkills.set(skill.name, skill);
        }
      }
    }

    this.manifests = Array.from(resolvedSkills.values()).sort((left, right) => {
      return left.name.localeCompare(right.name);
    });
    this.emit("skills:change", this.getSkills());
  }

  /** 获取技能索引列表 */
  getSkills(): SkillIndexEntry[] {
    return this.manifests.map((skill) => ({
      name: skill.name,
      description: skill.description,
      aliases: [...skill.aliases],
      directoryPath: skill.directoryPath,
      skillFilePath: skill.skillFilePath,
      sourceKind: skill.sourceKind,
      readonly: skill.readonly,
      enabled: skill.enabled,
      lockEntry: skill.lockEntry,
    }));
  }

  /** 获取已启用技能名称 */
  getEnabledSkillNames(): string[] {
    return this.manifests.filter((skill) => skill.enabled).map((skill) => skill.name);
  }

  /** 获取系统提示词中的技能索引段落 */
  getSkillIndexSummary(): string {
    return buildSkillsPromptSection(this.getSkills());
  }

  /** 切换技能启用状态 */
  toggleSkill(skillName: string): boolean {
    const targetSkill = this.manifests.find((skill) => skill.name === skillName);
    if (!targetSkill) {
      throw new Error(`Skill "${skillName}" not found`);
    }

    const nextEnabled = this.stateStore.toggleSkill(
      targetSkill.sourceKind,
      this.workingDirectory,
      targetSkill.name,
    );
    this.reload();
    return nextEnabled;
  }

  /** 获取技能正文工具返回文本 */
  getSkillsToolResult(skillNames: string[]): string {
    const lines: string[] = [];
    const uniqueNames = Array.from(new Set(skillNames));

    for (const skillName of uniqueNames) {
      const skill = this.manifests.find((item) => item.name === skillName);
      if (!skill) {
        lines.push(`未找到技能: ${skillName}`);
        continue;
      }
      if (!skill.enabled) {
        lines.push(`技能已禁用，无法读取: ${skillName}`);
        continue;
      }

      lines.push(`=== SKILL: ${skill.name} ===`);
      lines.push(`description: ${skill.description}`);
      if (skill.aliases.length > 0) {
        lines.push(`aliases: ${skill.aliases.join(", ")}`);
      }
      lines.push(skill.content);
      lines.push(`=== END SKILL: ${skill.name} ===`);
    }

    return lines.join("\n");
  }

  /** 获取技能状态快照 */
  getStateSnapshot() {
    return this.stateStore.getSnapshot();
  }

  /** 监听技能变化 */
  on<K extends keyof SkillManagerEvents>(
    event: K,
    listener: SkillManagerEvents[K],
  ): this {
    return super.on(event, listener);
  }

  /** 取消监听技能变化 */
  off<K extends keyof SkillManagerEvents>(
    event: K,
    listener: SkillManagerEvents[K],
  ): this {
    return super.off(event, listener);
  }

  /** 触发技能变化事件 */
  emit<K extends keyof SkillManagerEvents>(
    event: K,
    ...args: Parameters<SkillManagerEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
