import { EventEmitter } from "events";

/**
 * 待确认的类型
 */
export type PendingType = "file" | "command";

/**
 * 待确认的文件变更
 */
export interface PendingChange {
  id: string;
  type: PendingType;
  // 文件变更相关
  filePath?: string;
  originalContent?: string;
  newContent?: string;
  // 命令执行相关
  command?: string;
  workingDirectory?: string;
  background?: boolean;
}

/**
 * 用户确认结果
 */
export type ConfirmResult = "accept" | "accept_all" | "reject";

/**
 * Diff 事件总线事件类型
 */
interface DiffBusEvents {
  "pending-change": (change: PendingChange) => void;
  "change-resolved": (id: string, result: ConfirmResult) => void;
}

/**
 * Diff 事件总线
 * 负责 write_file/execute_command 工具与 UI 层的通信
 */
class DiffBus extends EventEmitter {
  private pendingResolvers: Map<string, (result: ConfirmResult) => void> = new Map();
  private changeIdCounter = 0;
  private _skipConfirmForSession = false;
  
  // 用户确认等待时间累计（用于计时扣除）
  private _totalWaitTime = 0;
  private _waitStartTime: number | null = null;

  constructor() {
    super();
  }

  /**
   * 生成变更 ID
   */
  private generateId(): string {
    this.changeIdCounter++;
    return `change-${this.changeIdCounter}-${Date.now()}`;
  }

  /**
   * 是否跳过本次会话的确认
   */
  get skipConfirmForSession(): boolean {
    return this._skipConfirmForSession;
  }

  /**
   * 设置跳过本次会话的确认
   */
  setSkipConfirmForSession(skip: boolean): void {
    this._skipConfirmForSession = skip;
  }

  /**
   * 获取本次会话累计的用户等待时间
   */
  get totalWaitTime(): number {
    return this._totalWaitTime;
  }

  /**
   * 重置会话状态（对话结束时调用）
   */
  resetSession(): void {
    this._skipConfirmForSession = false;
    this.changeIdCounter = 0;
    this._totalWaitTime = 0;
    this._waitStartTime = null;
  }

  /**
   * 重置本轮对话的跳过状态（用户发送新消息时调用）
   */
  resetSkipConfirm(): void {
    this._skipConfirmForSession = false;
    this._totalWaitTime = 0;
    this._waitStartTime = null;
  }

  /**
   * 请求用户确认文件变更
   */
  requestConfirm(
    filePath: string,
    originalContent: string,
    newContent: string
  ): Promise<ConfirmResult> {
    // 如果设置了跳过确认，直接返回接受
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

    // 记录等待开始时间
    this._waitStartTime = Date.now();

    return new Promise((resolve) => {
      this.pendingResolvers.set(change.id, resolve);
      this.emit("pending-change", change);
    });
  }

  /**
   * 请求用户确认命令执行
   */
  requestCommandConfirm(
    command: string,
    workingDirectory?: string,
    background?: boolean
  ): Promise<ConfirmResult> {
    // 如果设置了跳过确认，直接返回接受
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

    // 记录等待开始时间
    this._waitStartTime = Date.now();

    return new Promise((resolve) => {
      this.pendingResolvers.set(change.id, resolve);
      this.emit("pending-change", change);
    });
  }

  /**
   * 解决待确认的变更（由 UI 调用）
   */
  resolveChange(id: string, result: ConfirmResult): void {
    const resolver = this.pendingResolvers.get(id);
    if (resolver) {
      // 累计等待时间
      if (this._waitStartTime !== null) {
        this._totalWaitTime += Date.now() - this._waitStartTime;
        this._waitStartTime = null;
      }
      
      // 如果用户选择"同意且不再询问"，设置跳过标志
      if (result === "accept_all") {
        this._skipConfirmForSession = true;
      }
      resolver(result);
      this.pendingResolvers.delete(id);
      this.emit("change-resolved", id, result);
    }
  }

  // 类型安全的事件方法
  on<K extends keyof DiffBusEvents>(event: K, listener: DiffBusEvents[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof DiffBusEvents>(event: K, listener: DiffBusEvents[K]): this {
    return super.off(event, listener);
  }

  emit<K extends keyof DiffBusEvents>(
    event: K,
    ...args: Parameters<DiffBusEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// 导出单例
const diffBus = new DiffBus();
export default diffBus;
