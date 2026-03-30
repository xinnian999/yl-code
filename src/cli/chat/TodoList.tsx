import React from "react";
import { Box, Text } from "ink";
import type { TodoItem } from "@/core/types.ts";

/** 任务列表组件属性 */
export interface TodoListProps {
  /** 待展示任务 */
  todos: TodoItem[];
}

/** 任务行展示样式 */
interface TodoRowVisual {
  /** 图标 */
  icon: string;
  /** 颜色 */
  color: "green" | "cyan" | "gray";
  /** 可选标签 */
  tag?: string;
}

/** 去掉任务文本里不稳定的“当前任务”提示 */
function stripCurrentTaskMarker(content: string): string {
  return content.replace(/[（(]\s*当前任务\s*[)）]/g, "").trim();
}

/** 去掉任务文本前缀里的进度词，避免和 UI 状态重复 */
function stripProgressPrefix(content: string): string {
  if (content.startsWith("正在")) {
    return content.slice(2).trim();
  }

  if (content.startsWith("进行中：")) {
    return content.slice("进行中：".length).trim();
  }

  if (content.startsWith("进行中:")) {
    return content.slice("进行中:".length).trim();
  }

  return content.trim();
}

/** 规范化任务展示文案，避免当前任务和状态文案重复 */
function normalizeTodoContent(content: string): string {
  const contentWithoutMarker = stripCurrentTaskMarker(content);
  return stripProgressPrefix(contentWithoutMarker);
}

/** 获取当前任务索引，只认第一个 in_progress，避免错误猜测 */
function getCurrentTodoIndex(todos: TodoItem[]): number {
  return todos.findIndex((todo) => todo.status === "in_progress");
}

/** 根据任务状态构建静态展示样式 */
function getTodoRowVisual(todo: TodoItem, isCurrent: boolean): TodoRowVisual {
  if (todo.status === "completed") {
    return { icon: "✓", color: "green" };
  }

  if (isCurrent) {
    return { icon: "→", color: "cyan", tag: "当前" };
  }

  return { icon: "○", color: "gray" };
}

/** 任务列表组件 */
const TodoList: React.FC<TodoListProps> = ({ todos }) => {
  if (todos.length === 0) {
    return null;
  }

  const completed = todos.filter((todo) => todo.status === "completed").length;
  const currentTodoIndex = getCurrentTodoIndex(todos);

  return (
    <Box
      width="auto"
      flexDirection="column"
      marginTop={1}
      paddingX={1}
      borderStyle="round"
      borderColor="cyan"
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📋 任务进度 ({completed}/{todos.length})
        </Text>
      </Box>
      {todos.map((todo, index) => {
        const isCurrent = index === currentTodoIndex;
        const visual = getTodoRowVisual(todo, isCurrent);
        const content = normalizeTodoContent(todo.content);

        return (
          <Box key={index} marginBottom={index === todos.length - 1 ? 0 : 1}>
            <Box width={3}>
              <Text color={visual.color}>{visual.icon}</Text>
            </Box>
            <Box flexGrow={1}>
              <Text color={visual.color}>{content}</Text>
              {visual.tag ? <Text color="cyan">（{visual.tag}）</Text> : null}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

export default TodoList;
