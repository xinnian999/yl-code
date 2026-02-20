import React from "react";
import { Box, Text } from "ink";
import { TaskList, Task } from "ink-task-list";
import spinners from "cli-spinners";
import type { TodoItem, TodoStatusValue } from "@/core/types.ts";

/** 任务列表组件属性 */
interface TodoListProps {
  todos: TodoItem[];
}

/** 将内部任务状态映射为 ink-task-list 的 state */
function mapState(status: TodoStatusValue): "pending" | "loading" | "success" {
  if (status === "completed") return "success";
  if (status === "in_progress") return "loading";
  return "pending";
}

/**
 * 任务列表组件
 * 使用 ink-task-list 展示当前任务进度
 */
const TodoList: React.FC<TodoListProps> = ({ todos }) => {
  if (todos.length === 0) return null;

  const completed = todos.filter((t) => t.status === "completed").length;

  return (
    <Box flexDirection="column"  marginBottom={1} paddingX={1} borderStyle="round" borderColor="cyan">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📋 任务进度 ({completed}/{todos.length})
        </Text>
      </Box>
      <TaskList>
        {todos.map((todo, index) => {
          const state = mapState(todo.status);
          const label =
            todo.status === "in_progress" ? `正在${todo.content}` : todo.content;

          return (
            <Task
              key={index}
              label={label}
              state={state}
              spinner={spinners.dots}
            />
          );
        })}
      </TaskList>
    </Box>
  );
};

export default TodoList;
