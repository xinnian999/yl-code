import { EventEmitter } from "events";
import type { ConfirmPort, ConfirmResult } from "./types.ts";

export type { ConfirmResult } from "./types.ts";

// ============ 确认类型 ============

/** 待确认变更的类型 */
export type PendingType = "file" | "command";

/** 待确认的变更信息 */
export interface PendingChange {
  id: string;
  type: PendingType;
  filePath?: string;
  originalContent?: string;
  newContent?: string;
  command?: string;
  workingDirectory?: string;
  background?: boolean;
}

// ============ 事件类型 ============

/** 确认总线事件定义 */
interface ConfirmBusEvents {
  "pending-change": (change: PendingChange) => void;
  "change-resolved": (id: string, result: ConfirmResult) => void;
}

// ============ 确认总线 ============

/**
 * 确认总线 - 管理文件写入和命令执行的用户确认流程
 */
export class ConfirmBus extends EventEmitter implements ConfirmPort {
  /** 待处理的 Promise 解析器 */
  private pendingResolvers: Map<string, (result: ConfirmResult) => void> = new Map();
  /** 变更 ID 计数器 */
  private changeIdCounter = 0;
  /** 本次会话是否跳过确认 */
  private _skipConfirmForSession = false;
  /** 累计等待用户确认的时间 */
  private _totalWaitTime = 0;
  /** 等待开始时间戳 */
  private _waitStartTime: number | null = null;

  /** 生成唯一变更 ID */
  private generateId(): string {
    this.changeIdCounter++;
    return `change-${this.changeIdCounter}-${Date.now()}`;
  }

  /** 是否跳过确认 */
  get skipConfirmForSession(): boolean {
    return this._skipConfirmForSession;
  }

  /** 累计等待时间（毫秒） */
  get totalWaitTime(): number {
    return this._totalWaitTime;
  }

  /** 重置会话状态（计数器、跳过标记、等待时间） */
  resetSession(): void {
    this._skipConfirmForSession = false;
    this.changeIdCounter = 0;
    this._totalWaitTime = 0;
    this._waitStartTime = null;
  }

  /** 重置跳过确认标记和等待时间 */
  resetSkipConfirm(): void {
    this._skipConfirmForSession = false;
    this._totalWaitTime = 0;
    this._waitStartTime = null;
  }

  /** 请求文件写入确认，返回用户的确认结果 */
  requestConfirm(
    filePath: string,
    originalContent: string,
    newContent: string
  ): Promise<ConfirmResult> {
    if (this._skipConfirmForSession) {
      return Promise.resolve("accept");
    }

    const change: PendingChange = {
      id: this.generateId(),
      type: "file",
      filePath,
      originalContent,
      newContent,
    };

    this._waitStartTime = Date.now();

    return new Promise((resolve) => {
      this.pendingResolvers.set(change.id, resolve);
      this.emit("pending-change", change);
    });
  }

  /** 请求命令执行确认，返回用户的确认结果 */
  requestCommandConfirm(
    command: string,
    workingDirectory?: string,
    background?: boolean
  ): Promise<ConfirmResult> {
    if (this._skipConfirmForSession) {
      return Promise.resolve("accept");
    }

    const change: PendingChange = {
      id: this.generateId(),
      type: "command",
      command,
      workingDirectory,
      background,
    };

    this._waitStartTime = Date.now();

    return new Promise((resolve) => {
      this.pendingResolvers.set(change.id, resolve);
      this.emit("pending-change", change);
    });
  }

  /** 解析待确认变更，触发对应 Promise 回调 */
  resolveChange(id: string, result: ConfirmResult): void {
    const resolver = this.pendingResolvers.get(id);
    if (!resolver) return;

    if (this._waitStartTime !== null) {
      this._totalWaitTime += Date.now() - this._waitStartTime;
      this._waitStartTime = null;
    }

    if (result === "accept_all") {
      this._skipConfirmForSession = true;
    }

    resolver(result);
    this.pendingResolvers.delete(id);
    this.emit("change-resolved", id, result);
  }

  // 类型安全的事件方法
  on<K extends keyof ConfirmBusEvents>(event: K, listener: ConfirmBusEvents[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof ConfirmBusEvents>(event: K, listener: ConfirmBusEvents[K]): this {
    return super.off(event, listener);
  }

  emit<K extends keyof ConfirmBusEvents>(event: K, ...args: Parameters<ConfirmBusEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
