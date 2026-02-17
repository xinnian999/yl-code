import { EventEmitter } from "events";
import type { ContextPort, ContextUsage } from "../types.ts";
import { SUMMARIZE_THRESHOLD } from "./context-manager.ts";

// ============ 事件类型 ============

/** 上下文总线事件定义 */
interface ContextBusEvents {
  /** 上下文使用量更新时触发 */
  "context:update": (usage: ContextUsage) => void;
  /** 开始压缩上下文时触发 */
  "context:summarizing": () => void;
  /** 压缩完成时触发 */
  "context:summarized": (usage: ContextUsage) => void;
}

// ============ 上下文总线 ============

/**
 * 上下文总线 - 管理上下文使用量状态和事件通知
 * 跟踪 chatMessages 的 token 使用量，通知 UI 层更新显示
 */
export class ContextBus extends EventEmitter implements ContextPort {
  /** 当前 token 数 */
  private currentTokens = 0;
  /** 最大 token 数（可配置） */
  private maxTokens: number;

  constructor(maxTokens: number = SUMMARIZE_THRESHOLD) {
    super();
    this.maxTokens = maxTokens;
  }

  /** 获取当前上下文使用量快照 */
  getUsage(): ContextUsage {
    return {
      currentTokens: this.currentTokens,
      maxTokens: this.maxTokens,
      percentage: Math.min(
        Math.round((this.currentTokens / this.maxTokens) * 100),
        100
      ),
    };
  }

  /** 更新当前 token 数并通知 UI */
  updateUsage(currentTokens: number): void {
    this.currentTokens = currentTokens;
    this.emit("context:update", this.getUsage());
  }

  /** 通知 UI 开始压缩 */
  notifySummarizing(): void {
    this.emit("context:summarizing");
  }

  /** 通知 UI 压缩完成 */
  notifySummarized(): void {
    this.emit("context:summarized", this.getUsage());
  }

  /** 重置状态（新会话时） */
  reset(): void {
    this.currentTokens = 0;
    this.emit("context:update", this.getUsage());
  }

  // ============ 类型安全的事件方法 ============

  /** 类型安全的事件订阅 */
  on<K extends keyof ContextBusEvents>(
    event: K,
    listener: ContextBusEvents[K]
  ): this {
    return super.on(event, listener);
  }

  /** 类型安全的事件取消订阅 */
  off<K extends keyof ContextBusEvents>(
    event: K,
    listener: ContextBusEvents[K]
  ): this {
    return super.off(event, listener);
  }

  /** 类型安全的事件触发 */
  emit<K extends keyof ContextBusEvents>(
    event: K,
    ...args: Parameters<ContextBusEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
