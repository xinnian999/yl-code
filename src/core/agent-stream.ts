/**
 * Agent 流式响应模块 - 处理模型流式输出和调试日志
 */
import { concat } from "@langchain/core/utils/stream";
import type { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import { ThinkingStatus } from "./types.ts";
import type { MessageBus } from "./message-bus.ts";
import {
  getToolNameFromChunk,
  getToolArgsPreview,
  getToolDescription,
} from "./agent-helpers.ts";

/** 输出单个 chunk 的调试信息 */
export function logChunkDebug(messageBus: MessageBus, chunk: any, index: number): void {
  const parts: string[] = [`#${index}`];

  if (chunk.content) {
    const text = typeof chunk.content === "string" ? chunk.content : JSON.stringify(chunk.content);
    parts.push(`text: "${text}"`);
  }

  if (chunk.tool_call_chunks?.length > 0) {
    for (const tc of chunk.tool_call_chunks) {
      if (tc.name) parts.push(`tool: ${tc.name}`);
      if (tc.args) parts.push(`args: ${tc.args}`);
    }
  }

  // 只在有实质内容时输出，跳过空 chunk
  if (parts.length > 1) {
    messageBus.debug(parts.join(" | "));
  }
}

/** 输出完整响应的调试信息，用于排查工具调用问题 */
export function logResponseDebug(messageBus: MessageBus, response: any): void {
  const toolCalls = response.tool_calls;
  const kwargs = response.additional_kwargs;

  messageBus.debug(`tool_calls: ${toolCalls ? JSON.stringify(toolCalls).slice(0, 300) : "无"}`);

  if (kwargs) {
    const kwargKeys = Object.keys(kwargs);
    messageBus.debug(`additional_kwargs keys: [${kwargKeys.join(", ")}]`);
    if (kwargs.tool_calls) {
      messageBus.debug(`kwargs.tool_calls: ${JSON.stringify(kwargs.tool_calls).slice(0, 300)}`);
    }
  }

  if (response.response_metadata) {
    const meta = response.response_metadata;
    const finishReason = meta.finish_reason || meta.stop_reason || "未知";
    messageBus.debug(`finish_reason: ${finishReason}`);
  }

  const contentType = typeof response.content;
  const contentLen = contentType === "string" ? response.content.length : JSON.stringify(response.content).length;
  messageBus.debug(`content 类型: ${contentType} | 长度: ${contentLen}`);
}

/** 流式调用模型并实时输出文本到 UI */
export async function streamModelResponse(
  messageBus: MessageBus,
  debugMode: boolean,
  model: ReturnType<ChatOpenAI["bindTools"]>,
  chatMessages: BaseMessage[],
  signal: AbortSignal
): Promise<any> {
  const stream = await model.stream(chatMessages, { signal });

  let response: any;
  let currentToolName: string | null = null;
  let currentToolArgs: string | null = null;
  let chunkIndex = 0;
  let streamBlockIndex = -1;

  for await (const chunk of stream) {
    response = response ? concat(response, chunk) : chunk;

    // 流式输出文本内容到 UI
    if (chunk.content) {
      const text = typeof chunk.content === "string" ? chunk.content : String(chunk.content);
      if (text) {
        if (streamBlockIndex === -1) {
          messageBus.setThinkingStatus(ThinkingStatus.IDLE);
          streamBlockIndex = messageBus.createTextBlock(text);
          messageBus.setStreamingBlock(streamBlockIndex);
        } else {
          messageBus.appendToBlock(streamBlockIndex, text);
        }
      }
    }

    if (debugMode) {
      logChunkDebug(messageBus, chunk, chunkIndex);
      chunkIndex++;
    }

    const chunkAny = chunk as any;
    if (chunkAny.tool_call_chunks?.length > 0) {
      const toolName = getToolNameFromChunk(chunkAny.tool_call_chunks);
      const toolArgs = getToolArgsPreview(chunkAny.tool_call_chunks);

      if (toolName && toolName !== currentToolName) {
        currentToolName = toolName;
        messageBus.setThinkingStatus(ThinkingStatus.TOOL_CALLING, `准备调用: ${toolName}`);
      }

      if (toolArgs && toolArgs !== currentToolArgs) {
        currentToolArgs = toolArgs;
        const toolDesc = getToolDescription(currentToolName!, {
          filePath: toolArgs,
          directoryPath: toolArgs,
          command: toolArgs,
        });
        messageBus.setThinkingStatus(ThinkingStatus.TOOL_CALLING, toolDesc);
      }
    }
  }

  // 流式输出结束，清除流式状态
  messageBus.clearStreamingBlock();

  if (debugMode) {
    messageBus.debug(`流式完成，共 ${chunkIndex} 个 chunk`);
    logResponseDebug(messageBus, response);
  }

  return response;
}
