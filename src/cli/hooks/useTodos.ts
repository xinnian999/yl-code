import { useState, useEffect } from "react";
import type { TodoItem } from "@/core/types.ts";
import type { Agent } from "@/core/agent.ts";

/**
 * 任务列表状态管理 hook
 * 订阅 agent.todoBus 事件，管理任务列表状态
 */
export function useTodos(agent: Agent) {
  const [todos, setTodos] = useState<TodoItem[]>(() => agent.todoBus.getTodos());

  useEffect(() => {
    const handleUpdate = (updatedTodos: TodoItem[]) => {
      setTodos([...updatedTodos]);
    };

    const handleClear = () => {
      setTodos([]);
    };

    const { todoBus } = agent;
    todoBus.on("todo:update", handleUpdate);
    todoBus.on("todo:clear", handleClear);

    return () => {
      todoBus.off("todo:update", handleUpdate);
      todoBus.off("todo:clear", handleClear);
    };
  }, [agent]);

  return { todos };
}
