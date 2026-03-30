import { AgentMode } from "../types.ts";
import type { ConfirmPort, ProcessPort, TodoPort } from "../types.ts";
import type { ModeTool } from "./types.ts";
import {
  createReadFileTool,
  createWriteFileTool,
  createWriteFilePatchTool,
  createListDirectoryTool,
} from "./file-tools.ts";
import {
  createExecuteCommandTool,
  createReadBackgroundLogsTool,
} from "./command-tools.ts";
import { createTodoWriteTool } from "./todo-tool.ts";

/** 创建 core 内置工具集合，并标记对应可用模式 */
export function createTools(
  confirm: ConfirmPort,
  processPort: ProcessPort,
  todoPort: TodoPort
): ModeTool[] {
  const readFileTool = createReadFileTool();
  const listDirectoryTool = createListDirectoryTool();
  const writeFileTool = createWriteFileTool(confirm);
  const writeFilePatchTool = createWriteFilePatchTool(confirm);
  const executeCommandTool = createExecuteCommandTool(confirm, processPort);
  const readBackgroundLogsTool = createReadBackgroundLogsTool(processPort);
  const todoWriteTool = createTodoWriteTool(todoPort);

  return [
    { tool: readFileTool, modes: [AgentMode.ASK, AgentMode.BUILD, AgentMode.PLAN] },
    { tool: listDirectoryTool, modes: [AgentMode.ASK, AgentMode.BUILD, AgentMode.PLAN] },
    { tool: writeFileTool, modes: [AgentMode.BUILD] },
    { tool: writeFilePatchTool, modes: [AgentMode.BUILD] },
    { tool: executeCommandTool, modes: [AgentMode.BUILD] },
    { tool: readBackgroundLogsTool, modes: [AgentMode.BUILD] },
    { tool: todoWriteTool, modes: [AgentMode.BUILD] },
  ];
}
