/**
 * Agent 工具执行模块 - 执行工具调用和处理 API 错误
 */
import { ToolMessage, AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { getToolsForMode } from "../tooling/types.ts";
import { AgentMode, ThinkingStatus } from "../types.ts";
import type { ConfigManager } from "../config/config-manager.ts";
import type { AgentContext } from "./helpers.ts";
import {
  getToolDescription,
  type ToolCall,
  type ToolArgs,
} from "./helpers.ts";
import { isPlanInteractionToolName } from "../plan/interaction-parser.ts";

function getStringArg(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeToolArgs(
  toolName: string,
  rawArgs: unknown
): { args: Record<string, unknown>; repaired: boolean } {
  const args =
    rawArgs && typeof rawArgs === "object"
      ? { ...(rawArgs as Record<string, unknown>) }
      : {};
  let repaired = false;

  const setAlias = (targetKey: string, ...candidates: string[]) => {
    if (getStringArg(args[targetKey])) return;
    for (const key of candidates) {
      const value = getStringArg(args[key]);
      if (value) {
        args[targetKey] = value;
        repaired = true;
        return;
      }
    }
  };

  switch (toolName) {
    case "read_file":
    case "write_file":
    case "write_file_patch":
      setAlias("filePath", "file", "path");
      break;
    case "get_skills": {
      if (Array.isArray(args.skillNames)) break;

      const singleSkillName = getStringArg(args.skillName);
      if (singleSkillName) {
        args.skillNames = [singleSkillName];
        repaired = true;
        break;
      }

      const names = Array.isArray(args.names) ? args.names : args.skills;
      if (Array.isArray(names)) {
        args.skillNames = names.filter((item) => typeof item === "string");
        repaired = true;
      }
      break;
    }
    case "list_directory":
      setAlias("directoryPath", "directory", "dir", "path", "filePath");
      break;
    case "execute_command":
      setAlias("workingDirectory", "cwd");
      break;
  }

  return { args, repaired };
}

function getMissingRequiredArgs(toolName: string, args: Record<string, unknown>): string[] {
  switch (toolName) {
    case "read_file":
      return getStringArg(args.filePath) ? [] : ["filePath"];
    case "get_skills":
      return Array.isArray(args.skillNames) && args.skillNames.length > 0
        ? []
        : ["skillNames"];
    case "write_file": {
      const missing: string[] = [];
      if (!getStringArg(args.filePath)) missing.push("filePath");
      if (typeof args.content !== "string") missing.push("content");
      return missing;
    }
    case "write_file_patch": {
      const missing: string[] = [];
      if (!getStringArg(args.filePath)) missing.push("filePath");
      if (typeof args.patch !== "string") missing.push("patch");
      return missing;
    }
    case "execute_command":
      return getStringArg(args.command) ? [] : ["command"];
    case "list_directory":
      return getStringArg(args.directoryPath) ? [] : ["directoryPath"];
    case "read_background_logs":
      return [];
    case "todo_write":
      return Array.isArray(args.todos) ? [] : ["todos"];
    default:
      return [];
  }
}

function getToolArgsExample(toolName: string): string | null {
  switch (toolName) {
    case "read_file":
      return '{"filePath":"src/index.ts"}';
    case "get_skills":
      return '{"skillNames":["find-skills"]}';
    case "write_file":
      return '{"filePath":"src/index.ts","content":"..."}';
    case "write_file_patch":
      return '{"filePath":"src/index.ts","patch":"@@ ..."}';
    case "execute_command":
      return '{"command":"bun run build","workingDirectory":"project"}';
    case "read_background_logs":
      return '{"command":"bun run dev","maxChars":4000}';
    case "list_directory":
      return '{"directoryPath":"src"}';
    case "todo_write":
      return '{"todos":[{"content":"完成任务","status":"in_progress"}]}';
    default:
      return null;
  }
}

function buildToolArgsError(toolName: string, missingFields: string[]): string {
  const fieldsText = missingFields.join(", ");
  const example = getToolArgsExample(toolName);
  return example
    ? `工具参数错误: ${toolName} 缺少必填字段 ${fieldsText}。请严格按 schema 重试，例如 ${example}`
    : `工具参数错误: ${toolName} 缺少必填字段 ${fieldsText}。请严格按 schema 重试。`;
}

/** 构建计划伪工具的纠正文案 */
function buildPlanInteractionToolGuidance(toolName: string): string {
  if (toolName === "plan_question") {
    return "plan_question 是结构化输出标签，不是真实工具。请直接输出 <plan_question> JSON </plan_question>。";
  }

  return `${toolName} 是结构化输出标签，不是真实工具。请直接输出对应标签块。`;
}

export function normalizeResponseToolCalls(response: any): void {
  if (!response?.tool_calls || response.tool_calls.length === 0) return;

  response.tool_calls = response.tool_calls.map((toolCall: ToolCall, index: number) => {
    const { args } = normalizeToolArgs(toolCall.name, toolCall.args);

    const rawToolCall = response.additional_kwargs?.tool_calls?.[index];
    if (rawToolCall?.function && typeof rawToolCall.function.arguments === "string") {
      try {
        const parsedArgs = JSON.parse(rawToolCall.function.arguments);
        rawToolCall.function.arguments = JSON.stringify(
          normalizeToolArgs(toolCall.name, parsedArgs).args
        );
      } catch {
        // 保留原始参数文本，避免影响调试信息
      }
    }

    return { ...toolCall, args };
  });
}

/** 标准化响应，确保空内容时有占位文本 */
export function normalizeResponse(response: any): BaseMessage {
  const hasEmptyContent =
    !response.content ||
    (typeof response.content === "string" && response.content.trim() === "");

  if (hasEmptyContent && response.tool_calls?.length > 0) {
    return new AIMessage({
      content: "正在执行工具...",
      tool_calls: response.tool_calls,
      additional_kwargs: response.additional_kwargs,
      response_metadata: response.response_metadata,
    });
  }
  return response;
}

/** 处理 API 调用错误，附加配置诊断信息 */
export function handleApiError(config: ConfigManager, error: unknown): never {
  const err = error as any;
  const errorMessage = err?.message || err?.error?.message || String(error);
  const errorDetails = err?.error || err?.response?.data || err;

  const modelConfig = config.getCurrentModel();
  if (!modelConfig.apiKey) {
    throw new Error("未配置模型 API Key，请检查 ~/.yl/config.json");
  }
  if (!modelConfig.baseUrl) {
    throw new Error("未配置模型 Base URL，请检查 ~/.yl/config.json");
  }
  if (!modelConfig.modelName) {
    throw new Error("未配置模型名称，请检查 ~/.yl/config.json");
  }

  const detailedError = new Error(
    `API 调用失败: ${errorMessage}${errorDetails ? `\n详细信息: ${JSON.stringify(errorDetails, null, 2)}` : ""}`
  );
  (detailedError as any).cause = error;
  throw detailedError;
}

/** 根据当前模式生成工具不可用时的提示文案 */
function buildModeUnavailableMessage(
  mode: AgentContext["mode"],
  toolName: string
): string {
  switch (mode) {
    case AgentMode.ASK:
      return `工具 "${toolName}" 在 Ask 模式下不可用。Ask 模式仅支持只读分析，请切换到 Build 模式执行修改或命令。`;
    case AgentMode.PLAN:
      return `工具 "${toolName}" 在 Plan 模式下不可用。Plan 模式仅支持只读探索与产出计划，请切换到 Build 模式执行修改或命令。`;
    default:
      return `工具 "${toolName}" 在当前模式下不可用，请切换到 Build 模式。`;
  }
}

/** 执行响应中的工具调用列表 */
export async function executeToolCalls(
  ctx: AgentContext,
  response: any
): Promise<void> {
  const allowedTools = getToolsForMode(ctx.tools, ctx.mode);

  for (const toolCall of response.tool_calls as ToolCall[]) {
    const { args: normalizedArgs, repaired } = normalizeToolArgs(toolCall.name, toolCall.args);
    toolCall.args = normalizedArgs;

    const foundTool = allowedTools.find((t) => t.name === toolCall.name);
    const toolDesc = getToolDescription(toolCall.name, normalizedArgs as ToolArgs);

    ctx.messageBus.setThinkingStatus(ThinkingStatus.TOOL_CALLING, `执行中: ${toolDesc}`);

    if (isPlanInteractionToolName(toolCall.name)) {
      ctx.chatMessages.push(
        new ToolMessage({
          content: buildPlanInteractionToolGuidance(toolCall.name),
          tool_call_id: toolCall.id,
        })
      );
      continue;
    }

    if (!foundTool) {
      const isKnownTool = ctx.tools.some((t) => t.tool.name === toolCall.name);
      const errorMsg = isKnownTool
        ? buildModeUnavailableMessage(ctx.mode, toolCall.name)
        : `工具 "${toolCall.name}" 未找到`;

      ctx.messageBus.tool(`调用工具: ${toolCall.name}`);
      ctx.messageBus.error(`   ↳ ${errorMsg}`);
      ctx.chatMessages.push(
        new ToolMessage({ content: errorMsg, tool_call_id: toolCall.id })
      );
      continue;
    }

    const missingFields = getMissingRequiredArgs(toolCall.name, normalizedArgs);
    if (missingFields.length > 0) {
      const errMsg = buildToolArgsError(toolCall.name, missingFields);
      ctx.messageBus.tool(`${toolDesc} (参数不完整)`);
      ctx.messageBus.warning(`   ↳ ${errMsg}`);
      ctx.chatMessages.push(
        new ToolMessage({ content: errMsg, tool_call_id: toolCall.id })
      );
      continue;
    }

    try {
      const toolResult = await (foundTool as any).invoke(normalizedArgs);
      const toolResultText = String(toolResult);

      ctx.messageBus.tool(toolDesc);
      ctx.executionState.recordToolResult(toolCall.name, normalizedArgs, toolResultText);

      // debug 模式：将工具调用详情附加到 tool block
      if (ctx.debugMode) {
        const resultStr = toolResultText;
        const preview = resultStr.length > 500 ? resultStr.slice(0, 500) + "...(截断)" : resultStr;
        ctx.messageBus.appendDebugToLastBlock(JSON.stringify({
          tool: toolCall.name,
          id: toolCall.id,
          args: normalizedArgs,
          normalized: repaired,
          result: `(${resultStr.length}字符) ${preview}`,
        }, null, 2));
      }

      // todo_write 额外追加快照块
      if (toolCall.name === "todo_write") {
        ctx.messageBus.todoSnapshot(ctx.todoBus.getTodos());
      }

      ctx.chatMessages.push(
        new ToolMessage({ content: toolResultText, tool_call_id: toolCall.id })
      );
    } catch (error) {
      const err = error as Error;
      const errMsg = err?.message || String(error);
      ctx.messageBus.tool(toolDesc);
      ctx.messageBus.error(`   ↳ 失败: ${errMsg}`);
      ctx.executionState.recordToolResult(
        toolCall.name,
        normalizedArgs,
        `工具执行失败: ${errMsg}`
      );
      ctx.chatMessages.push(
        new ToolMessage({ content: `工具执行失败: ${errMsg}`, tool_call_id: toolCall.id })
      );
    }
  }
}
