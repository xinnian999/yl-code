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

/** 从响应中提取调试元数据 */
function extractResponseMeta(response: any): Record<string, unknown> {
  const meta: Record<string, unknown> = {};
  const toolCalls = response.tool_calls;
  meta.tool_calls = toolCalls ? JSON.stringify(toolCalls).slice(0, 300) : "无";

  if (response.additional_kwargs) {
    const kwargs = response.additional_kwargs;
    meta.additional_kwargs_keys = Object.keys(kwargs);
    if (kwargs.tool_calls) {
      meta.kwargs_tool_calls = JSON.stringify(kwargs.tool_calls).slice(0, 300);
    }
  }

  if (response.response_metadata) {
    const rm = response.response_metadata;
    meta.finish_reason = rm.finish_reason || rm.stop_reason || "未知";
  }

  const contentType = typeof response.content;
  const contentRaw = contentType === "string" ? response.content : JSON.stringify(response.content);
  meta.content_type = contentType;
  meta.content_length = contentRaw.length;
  meta.content = contentRaw.length > 1000 ? contentRaw.slice(0, 1000) + "...(截断)" : contentRaw;

  return meta;
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
          // debug 模式：流开始时设置初始 debug 标记
          if (debugMode) {
            messageBus.setDebugOnBlock(streamBlockIndex,
              JSON.stringify({ chunks: 0, status: "streaming" }, null, 2));
          }
        } else {
          messageBus.appendToBlock(streamBlockIndex, text);
        }
      }
    }

    if (debugMode) chunkIndex++;

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

  // debug 模式：用完整元数据替换初始 debug
  if (debugMode && streamBlockIndex !== -1) {
    const debugObj = { chunks: chunkIndex, ...extractResponseMeta(response) };
    messageBus.setDebugOnBlock(streamBlockIndex, JSON.stringify(debugObj, null, 2));
  }

  return response;
}
