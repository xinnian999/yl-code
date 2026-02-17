import { useState, useEffect } from "react";
import type { TodoItem } from "@/core/types.ts";
import type { Agent } from "@/core/agent.ts";

/**
 * 任务列表状态管理 hook
 * 订阅 agent.todoBus 事件，以 Map<messageId, TodoItem[]> 管理多轮任务列表
 */
export function useTodos(agent: Agent) {
  const [todosMap, setTodosMap] = useState<Map<string, TodoItem[]>>(
    () => agent.todoBus.getAllTodos()
  );

  useEffect(() => {
    const handleUpdate = (messageId: string, todos: TodoItem[]) => {
      setTodosMap((prev) => new Map(prev).set(messageId, todos));
    };

    const handleClear = () => {
      setTodosMap(new Map());
    };

    const { todoBus } = agent;
    todoBus.on("todo:update", handleUpdate);
    todoBus.on("todo:clear", handleClear);

    return () => {
      todoBus.off("todo:update", handleUpdate);
      todoBus.off("todo:clear", handleClear);
    };
  }, [agent]);

  return { todosMap };
}
