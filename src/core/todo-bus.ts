import { EventEmitter } from "events";
import type { TodoPort, TodoItem } from "./types.ts";

// ============ 事件类型 ============

/** Todo 总线事件定义 */
interface TodoBusEvents {
  /** 任务列表更新时触发 */
  "todo:update": (todos: TodoItem[]) => void;
  /** 任务列表被清空时触发 */
  "todo:clear": () => void;
}

// ============ Todo 总线 ============

/**
 * Todo 总线 - 管理任务列表状态和事件通知
 * AI 通过 todo_write 工具调用此总线更新任务，UI 通过事件订阅实时渲染
 */
export class TodoBus extends EventEmitter implements TodoPort {
  /** 当前任务列表 */
  private todos: TodoItem[] = [];

  /** 更新整个任务列表（全量替换），并通知 UI */
  updateTodos(todos: TodoItem[]): void {
    this.todos = todos.map((t) => ({ ...t }));
    this.emit("todo:update", this.getTodos());
  }

  /** 获取当前任务列表的副本 */
  getTodos(): TodoItem[] {
    return this.todos.map((t) => ({ ...t }));
  }

  /** 清空任务列表并通知 UI */
  clearTodos(): void {
    this.todos = [];
    this.emit("todo:clear");
  }

  /** 将所有未完成的任务标记为 completed，并通知 UI */
  completeAll(): void {
    if (this.todos.length === 0) return;
    const hasIncomplete = this.todos.some((t) => t.status !== "completed");
    if (!hasIncomplete) return;

    this.todos = this.todos.map((t) => ({ ...t, status: "completed" as const }));
    this.emit("todo:update", this.getTodos());
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
