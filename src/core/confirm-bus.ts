import { EventEmitter } from "events";
import type { ConfirmPort, ConfirmResult } from "./types.ts";

export type { ConfirmResult } from "./types.ts";

// ============ 确认类型 ============

export type PendingType = "file" | "command";

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

interface ConfirmBusEvents {
  "pending-change": (change: PendingChange) => void;
  "change-resolved": (id: string, result: ConfirmResult) => void;
}

// ============ 确认总线 ============

export class ConfirmBus extends EventEmitter implements ConfirmPort {
  private pendingResolvers: Map<string, (result: ConfirmResult) => void> = new Map();
  private changeIdCounter = 0;
  private _skipConfirmForSession = false;
  private _totalWaitTime = 0;
  private _waitStartTime: number | null = null;

  private generateId(): string {
    this.changeIdCounter++;
    return `change-${this.changeIdCounter}-${Date.now()}`;
  }

  get skipConfirmForSession(): boolean {
    return this._skipConfirmForSession;
  }

  get totalWaitTime(): number {
    return this._totalWaitTime;
  }

  resetSession(): void {
    this._skipConfirmForSession = false;
    this.changeIdCounter = 0;
    this._totalWaitTime = 0;
    this._waitStartTime = null;
  }

  resetSkipConfirm(): void {
    this._skipConfirmForSession = false;
    this._totalWaitTime = 0;
    this._waitStartTime = null;
  }

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
