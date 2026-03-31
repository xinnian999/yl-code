import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { SkillSourceKind, SkillStateSnapshot } from "./types.ts";

/** 技能状态存储 */
export class SkillStateStore {
  /** 状态文件路径 */
  private readonly stateFilePath: string;
  /** 当前状态快照 */
  private state: SkillStateSnapshot;

  constructor(stateFilePath: string) {
    this.stateFilePath = stateFilePath;
    this.state = this.loadState();
  }

  /** 加载状态快照 */
  private loadState(): SkillStateSnapshot {
    if (!existsSync(this.stateFilePath)) {
      return {
        global: {},
        workspaces: {},
      };
    }

    try {
      const rawContent = readFileSync(this.stateFilePath, "utf-8");
      const parsed = JSON.parse(rawContent) as Partial<SkillStateSnapshot>;
      return {
        global: parsed.global ?? {},
        workspaces: parsed.workspaces ?? {},
      };
    } catch {
      return {
        global: {},
        workspaces: {},
      };
    }
  }

  /** 持久化状态快照 */
  private saveState(): void {
    mkdirSync(dirname(this.stateFilePath), { recursive: true });
    writeFileSync(this.stateFilePath, JSON.stringify(this.state, null, 2), "utf-8");
  }

  /** 判断来源类型是否按工作区维度保存 */
  private isWorkspaceScoped(sourceKind: SkillSourceKind): boolean {
    return sourceKind === "workspace_agents" || sourceKind === "workspace_local";
  }

  /** 获取标准化工作区键名 */
  private toWorkspaceKey(workingDirectory: string): string {
    return resolve(workingDirectory);
  }

  /** 获取技能当前开关状态，默认启用 */
  getEnabled(
    sourceKind: SkillSourceKind,
    workingDirectory: string,
    skillName: string,
  ): boolean {
    if (this.isWorkspaceScoped(sourceKind)) {
      const workspaceKey = this.toWorkspaceKey(workingDirectory);
      const workspaceState = this.state.workspaces[workspaceKey];
      if (workspaceState && skillName in workspaceState) {
        return workspaceState[skillName];
      }

      return true;
    }

    if (skillName in this.state.global) {
      return this.state.global[skillName];
    }

    return true;
  }

  /** 切换技能开关状态并返回更新后的状态 */
  toggleSkill(
    sourceKind: SkillSourceKind,
    workingDirectory: string,
    skillName: string,
  ): boolean {
    const nextEnabled = !this.getEnabled(sourceKind, workingDirectory, skillName);
    this.setEnabled(sourceKind, workingDirectory, skillName, nextEnabled);
    return nextEnabled;
  }

  /** 设置技能开关状态 */
  setEnabled(
    sourceKind: SkillSourceKind,
    workingDirectory: string,
    skillName: string,
    enabled: boolean,
  ): void {
    if (this.isWorkspaceScoped(sourceKind)) {
      const workspaceKey = this.toWorkspaceKey(workingDirectory);
      const workspaceState = this.state.workspaces[workspaceKey] ?? {};
      workspaceState[skillName] = enabled;
      this.state.workspaces[workspaceKey] = workspaceState;
      this.saveState();
      return;
    }

    this.state.global[skillName] = enabled;
    this.saveState();
  }

  /** 获取当前状态快照副本 */
  getSnapshot(): SkillStateSnapshot {
    return {
      global: { ...this.state.global },
      workspaces: Object.fromEntries(
        Object.entries(this.state.workspaces).map(([workspace, state]) => [
          workspace,
          { ...state },
        ]),
      ),
    };
  }
}
