/**
 * Agent 流式响应模块 - 处理模型流式输出和调试日志
 */
import { concat } from "@langchain/core/utils/stream";
import type { ChatOpenAI } from "@langchain/openai";
import type { BaseMessage } from "@langchain/core/messages";
import { ThinkingStatus } from "../types.ts";
import type { MessageBus } from "../message-bus.ts";
import {
  getToolNameFromChunk,
  getToolArgsPreview,
  getToolDescription,
} from "./helpers.ts";

/** 为流式错误附加可见输出标记 */
function markStreamError(error: unknown, hasVisibleOutput: boolean): Error {
  const streamError = error instanceof Error ? error : new Error(String(error));
  (streamError as Error & { hasVisibleOutput?: boolean }).hasVisibleOutput = hasVisibleOutput;
  return streamError;
}

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
  let pendingText = "";
  let lastFlushTime = 0;
  const FLUSH_INTERVAL_MS = 120;

  try {
    for await (const chunk of stream) {
      response = response ? concat(response, chunk) : chunk;

      // 累积文本内容，按时间间隔批量刷新到 UI，减少终端重绘次数
      if (chunk.content) {
        const text = typeof chunk.content === "string" ? chunk.content : String(chunk.content);
        if (text) {
          if (streamBlockIndex === -1) {
            messageBus.setThinkingStatus(ThinkingStatus.IDLE);
            streamBlockIndex = messageBus.createTextBlock(text);
            messageBus.setStreamingBlock(streamBlockIndex);
            lastFlushTime = Date.now();
          } else {
            pendingText += text;
            const now = Date.now();
            if (now - lastFlushTime >= FLUSH_INTERVAL_MS) {
              messageBus.appendToBlock(streamBlockIndex, pendingText);
              pendingText = "";
              lastFlushTime = now;
            }
          }
        }
      }

      if (debugMode) {
        chunkIndex++;
        const now = Date.now();
        if (streamBlockIndex !== -1 && response && now - lastFlushTime >= FLUSH_INTERVAL_MS) {
          const debugObj = {
            chunks: chunkIndex,
            status: "streaming",
            ...extractResponseMeta(response),
          };
          messageBus.setDebugOnBlock(
            streamBlockIndex,
            JSON.stringify(debugObj, null, 2)
          );
        }
      }

      const chunkAny = chunk as any;
      if (chunkAny.tool_call_chunks?.length > 0) {
        const toolName = getToolNameFromChunk(chunkAny.tool_call_chunks);
        const toolArgs = getToolArgsPreview(chunkAny.tool_call_chunks);

        if (toolName && toolName !== currentToolName) {
          currentToolName = toolName;
          messageBus.setThinkingStatus(ThinkingStatus.TOOL_CALLING, `正在调用工具: ${toolName}`);
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
  } catch (error) {
    messageBus.clearStreamingBlock();
    throw markStreamError(error, streamBlockIndex !== -1);
  }

  // 流式输出结束，先刷新剩余文本与最终调试信息，再清除流式状态
  if (streamBlockIndex !== -1 && pendingText) {
    messageBus.appendToBlock(streamBlockIndex, pendingText);
  }

  if (debugMode && streamBlockIndex !== -1) {
    const debugObj = {
      chunks: chunkIndex,
      status: "done",
      ...extractResponseMeta(response),
    };
    messageBus.setDebugOnBlock(streamBlockIndex, JSON.stringify(debugObj, null, 2));
  }

  messageBus.clearStreamingBlock();

  return response;
}

/** 非流式调用模型，并在结束后一次性写入 UI */
export async function invokeModelResponse(
  messageBus: MessageBus,
  debugMode: boolean,
  model: ReturnType<ChatOpenAI["bindTools"]>,
  chatMessages: BaseMessage[],
  signal: AbortSignal
): Promise<any> {
  const response = await model.invoke(chatMessages, { signal });
  const content =
    typeof response.content === "string"
      ? response.content
      : JSON.stringify(response.content);

  if (content.trim()) {
    // 非流式模式下，拿到完整文本就应立即结束“思考中”状态，
    // 否则 UI 会在内容已展示时仍然显示 spinner。
    messageBus.setThinkingStatus(ThinkingStatus.IDLE);
    const blockIndex = messageBus.createTextBlock(content);
    if (debugMode) {
      const debugObj = {
        chunks: 1,
        status: "done",
        mode: "non_stream",
        ...extractResponseMeta(response),
      };
      messageBus.setDebugOnBlock(blockIndex, JSON.stringify(debugObj, null, 2));
    }
    messageBus.clearStreamingBlock();
    return response;
  }

  if (debugMode) {
    messageBus.ai("");
    messageBus.appendDebugToLastBlock(
      JSON.stringify(
        {
          chunks: 1,
          status: "done",
          mode: "non_stream",
          ...extractResponseMeta(response),
        },
        null,
        2
      )
    );
  }

  return response;
}
