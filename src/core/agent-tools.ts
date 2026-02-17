/**
 * Agent 工具执行模块 - 执行工具调用和处理 API 错误
 */
import { ToolMessage, AIMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { getToolsForMode } from "./tools.ts";
import { ThinkingStatus } from "./types.ts";
import type { ConfigManager } from "./config.ts";
import type { AgentContext } from "./agent-helpers.ts";
import {
  formatDuration,
  getToolDescription,
  type ToolCall,
  type ToolArgs,
} from "./agent-helpers.ts";

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
    throw new Error("未配置模型 API Key，请检查 ~/.niu-code/config.json");
  }
  if (!modelConfig.baseUrl) {
    throw new Error("未配置模型 Base URL，请检查 ~/.niu-code/config.json");
  }
  if (!modelConfig.modelName) {
    throw new Error("未配置模型名称，请检查 ~/.niu-code/config.json");
  }

  const detailedError = new Error(
    `API 调用失败: ${errorMessage}${errorDetails ? `\n详细信息: ${JSON.stringify(errorDetails, null, 2)}` : ""}`
  );
  (detailedError as any).cause = error;
  throw detailedError;
}

/** 执行响应中的工具调用列表 */
export async function executeToolCalls(
  ctx: AgentContext,
  response: any,
  iterationStartTime: number
): Promise<void> {
  const allowedTools = getToolsForMode(ctx.tools, ctx.mode);

  for (const toolCall of response.tool_calls as ToolCall[]) {
    const foundTool = allowedTools.find((t) => t.name === toolCall.name);
    const toolDesc = getToolDescription(toolCall.name, toolCall.args as ToolArgs);

    if (ctx.debugMode) {
      ctx.messageBus.debug(`工具调用: ${toolCall.name} | id: ${toolCall.id}`);
      ctx.messageBus.debug(`参数: ${JSON.stringify(toolCall.args)}`);
    }

    ctx.messageBus.setThinkingStatus(ThinkingStatus.TOOL_CALLING, `执行中: ${toolDesc}`);

    if (!foundTool) {
      const isKnownTool = ctx.tools.some((t) => t.tool.name === toolCall.name);
      const errorMsg = isKnownTool
        ? `工具 "${toolCall.name}" 在当前模式下不可用，请切换到 Build 模式`
        : `工具 "${toolCall.name}" 未找到`;

      ctx.messageBus.tool(`调用工具: ${toolCall.name}`);
      ctx.messageBus.error(`   ↳ ${errorMsg}`);
      ctx.chatMessages.push(
        new ToolMessage({ content: errorMsg, tool_call_id: toolCall.id })
      );
      continue;
    }

    try {
      const waitTimeBefore = ctx.confirmBus.totalWaitTime;
      const toolStartTime = Date.now();
      const toolResult = await (foundTool as any).invoke(toolCall.args);
      const waitTimeAdded = ctx.confirmBus.totalWaitTime - waitTimeBefore;
      const toolDuration = Date.now() - toolStartTime - waitTimeAdded;

      ctx.messageBus.tool(`${toolDesc} (耗时: ${formatDuration(toolDuration)})`);

      if (ctx.debugMode) {
        const resultStr = String(toolResult);
        const preview = resultStr.length > 500 ? resultStr.slice(0, 500) + "...(截断)" : resultStr;
        ctx.messageBus.debug(`返回结果 (${resultStr.length}字符): ${preview}`);
      }

      ctx.chatMessages.push(
        new ToolMessage({ content: toolResult as string, tool_call_id: toolCall.id })
      );
    } catch (error) {
      const toolDuration = Date.now() - iterationStartTime;
      const err = error as Error;
      const errMsg = err?.message || String(error);
      ctx.messageBus.tool(`${toolDesc} (耗时: ${formatDuration(toolDuration)})`);
      ctx.messageBus.error(`   ↳ 失败: ${errMsg}`);
      ctx.chatMessages.push(
        new ToolMessage({ content: `工具执行失败: ${errMsg}`, tool_call_id: toolCall.id })
      );
    }
  }
}
