import { EventEmitter } from "events";
import type { TodoPort, TodoItem } from "./types.ts";

// ============ 事件类型 ============

/** Todo 总线事件定义 */
interface TodoBusEvents {
  /** 任务列表更新时触发，携带消息 ID 和对应的任务列表 */
  "todo:update": (messageId: string, todos: TodoItem[]) => void;
  /** 所有任务列表被清空时触发（新会话） */
  "todo:clear": () => void;
}

// ============ Todo 总线 ============

/**
 * Todo 总线 - 管理任务列表状态和事件通知
 * 以 messageId 为 key 存储每轮对话的任务列表，支持多轮共存
 */
export class TodoBus extends EventEmitter implements TodoPort {
  /** 消息 ID → 任务列表 的映射 */
  private todosMap: Map<string, TodoItem[]> = new Map();
  /** 当前轮次绑定的 AI 消息 ID */
  private currentMessageId: string | null = null;

  /** 设置当前轮次的消息 ID，后续 updateTodos 会写入该 ID */
  setCurrentMessageId(id: string): void {
    this.currentMessageId = id;
  }

  /** 更新当前轮次的任务列表（全量替换），并通知 UI */
  updateTodos(todos: TodoItem[]): void {
    if (!this.currentMessageId) return;
    const copied = todos.map((t) => ({ ...t }));
    this.todosMap.set(this.currentMessageId, copied);
    this.emit("todo:update", this.currentMessageId, this.getTodos());
  }

  /** 获取当前轮次的任务列表副本 */
  getTodos(): TodoItem[] {
    if (!this.currentMessageId) return [];
    return (this.todosMap.get(this.currentMessageId) || []).map((t) => ({ ...t }));
  }

  /** 获取所有轮次的任务列表映射副本（UI 渲染用） */
  getAllTodos(): Map<string, TodoItem[]> {
    const result = new Map<string, TodoItem[]>();
    for (const [id, todos] of this.todosMap) {
      result.set(id, todos.map((t) => ({ ...t })));
    }
    return result;
  }

  /** 清空所有任务列表（新会话时调用） */
  clearTodos(): void {
    this.todosMap.clear();
    this.currentMessageId = null;
    this.emit("todo:clear");
  }

  /** 将当前轮次的未完成任务标记为 completed */
  completeAll(): void {
    if (!this.currentMessageId) return;
    const todos = this.todosMap.get(this.currentMessageId);
    if (!todos || todos.length === 0) return;

    const hasIncomplete = todos.some((t) => t.status !== "completed");
    if (!hasIncomplete) return;

    const completed = todos.map((t) => ({ ...t, status: "completed" as const }));
    this.todosMap.set(this.currentMessageId, completed);
    this.emit("todo:update", this.currentMessageId, completed.map((t) => ({ ...t })));
  }

  /** 类型安全的事件订阅 */
  on<K extends keyof TodoBusEvents>(event: K, listener: TodoBusEvents[K]): this {
    return super.on(event, listener);
  }

  /** 类型安全的事件取消订阅 */
  off<K extends keyof TodoBusEvents>(event: K, listener: TodoBusEvents[K]): this {
    return super.off(event, listener);
  }

  /** 类型安全的事件触发 */
  emit<K extends keyof TodoBusEvents>(event: K, ...args: Parameters<TodoBusEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
