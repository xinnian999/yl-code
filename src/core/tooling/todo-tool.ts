import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { TodoStatus, type TodoItem, type TodoPort } from "../types.ts";

/** todo_write 工具载荷 */
interface TodoWritePayload {
  /** 完整任务列表 */
  todos: Array<{ content: string; status: string }>;
}

/** 构建 Todo 汇总文本 */
function buildTodoSummary(todos: Array<{ status: string }>): string {
  const total = todos.length;
  const completed = todos.filter((item) => item.status === TodoStatus.COMPLETED).length;
  const inProgress = todos.filter((item) => item.status === TodoStatus.IN_PROGRESS).length;
  const pending = todos.filter((item) => item.status === TodoStatus.PENDING).length;
  return `共 ${total} 项: ${completed} 完成, ${inProgress} 进行中, ${pending} 待处理`;
}

/** 校验 Todo 状态是否合法 */
function hasInvalidTodoStatus(todos: Array<{ status: string }>): string | null {
  const validStatuses = Object.values(TodoStatus);
  for (const item of todos) {
    if (!validStatuses.includes(item.status as TodoItem["status"])) {
      return item.status;
    }
  }
  return null;
}

/** 创建 todo_write 工具 */
export function createTodoWriteTool(todoPort: TodoPort) {
  return tool(
    async ({ todos }: TodoWritePayload): Promise<string> => {
      const invalidStatus = hasInvalidTodoStatus(todos);
      if (invalidStatus) {
        return `无效的任务状态: "${invalidStatus}"，有效值为: ${Object.values(TodoStatus).join(", ")}`;
      }

      todoPort.updateTodos(todos as TodoItem[]);
      return `任务列表已更新。${buildTodoSummary(todos)}`;
    },
    {
      name: "todo_write",
      description: "创建或更新任务列表，用于跟踪多步骤任务的进度。每次调用传入完整的任务列表（全量替换）。",
      schema: z.object({
        todos: z
          .array(
            z.object({
              content: z.string().describe("任务描述（祈使句，如'运行测试'）"),
              status: z
                .enum(["pending", "in_progress", "completed"])
                .describe("任务状态"),
            })
          )
          .describe("完整的任务列表"),
      }),
    }
  );
}
