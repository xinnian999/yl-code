import {
  HumanMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import {
  CONTEXT_COMPACT_PREVIEW_CHARS,
  CONTEXT_COMPACT_THRESHOLD,
} from "../config/context-config.ts";
import { toDisplayPath } from "../path-display.ts";
import {
  getProtectedRecentStartIndex,
  isProtectedRecentMessage,
} from "./window.ts";

/** 生成压缩后的预览文本 */
function compactPreview(
  text: string,
  maxChars = CONTEXT_COMPACT_PREVIEW_CHARS
): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars)}...`;
}

/** 构建统一的压缩占位标记 */
function buildCompressedMarker(label: string, text: string): string {
  return `[已压缩${label}，原始长度 ${text.length} 字符，预览: ${compactPreview(text)}]`;
}

/** 按工具名压缩大体积参数 */
function compactToolCallArgs(
  toolName: string,
  rawArgs: unknown
): Record<string, unknown> {
  if (!rawArgs || typeof rawArgs !== "object") {
    return {};
  }

  const args = { ...(rawArgs as Record<string, unknown>) };
  switch (toolName) {
    case "write_file":
      if (
        typeof args.content === "string"
        && args.content.length > CONTEXT_COMPACT_THRESHOLD
      ) {
        args.content = buildCompressedMarker("写入内容", args.content);
      }
      break;
    case "write_file_patch":
      if (
        typeof args.patch === "string"
        && args.patch.length > CONTEXT_COMPACT_THRESHOLD
      ) {
        args.patch = buildCompressedMarker("补丁内容", args.patch);
      }
      break;
    case "execute_command":
      if (
        typeof args.command === "string"
        && args.command.length > CONTEXT_COMPACT_THRESHOLD
      ) {
        args.command = buildCompressedMarker("命令", args.command);
      }
      break;
  }

  return args;
}

/** 压缩 read_file 的大体积结果 */
function compactReadFileResult(content: string, filePath?: string): string {
  if (!content.startsWith("文件内容:\n")) {
    return content;
  }

  const body = content.slice("文件内容:\n".length);
  if (body.length <= CONTEXT_COMPACT_THRESHOLD) {
    return content;
  }

  const displayPath = filePath ? toDisplayPath(filePath) : "未知文件";
  return [
    `已读取文件 ${displayPath}（${body.length} 字符，内容已压缩）。`,
    `预览: ${compactPreview(body)}`,
    "如需完整内容，请重新调用 read_file。",
  ].join("\n");
}

/** 压缩 list_directory 的大体积结果 */
function compactListDirectoryResult(
  content: string,
  directoryPath?: string
): string {
  if (!content.startsWith("目录内容:\n")) {
    return content;
  }
  if (content.length <= CONTEXT_COMPACT_THRESHOLD) {
    return content;
  }

  const displayPath = directoryPath ? toDisplayPath(directoryPath) : "未知目录";
  return [
    `已读取目录 ${displayPath}（内容已压缩）。`,
    `预览: ${compactPreview(content.slice("目录内容:\n".length))}`,
  ].join("\n");
}

/** 压缩后台日志结果 */
function compactBackgroundLogsResult(content: string): string {
  if (!content.includes("日志:\n")) {
    return content;
  }
  if (content.length <= CONTEXT_COMPACT_THRESHOLD) {
    return content;
  }

  const markerIndex = content.indexOf("日志:\n");
  const head = content.slice(0, markerIndex + "日志:\n".length);
  const logs = content.slice(markerIndex + "日志:\n".length);

  return [
    `${head}[日志内容已压缩，原始长度 ${logs.length} 字符]`,
    `预览: ${compactPreview(logs)}`,
    "如需继续排查，请重新调用 read_background_logs。",
  ].join("\n");
}

/** 压缩用户通过 @ 引用注入的大段文件上下文 */
function compactHumanFileContext(content: string): string {
  const marker = "【用户引用的文件内容如下，请根据这些内容完成任务】";
  if (!content.includes(marker) || content.length <= CONTEXT_COMPACT_THRESHOLD) {
    return content;
  }
  if (content.includes("[引用内容已压缩")) {
    return content;
  }

  const markerIndex = content.indexOf(marker);
  const head = content.slice(0, markerIndex + marker.length);
  const quotedContent = content.slice(markerIndex + marker.length);

  return [
    head,
    `[引用内容已压缩，原始长度 ${quotedContent.length} 字符]`,
    compactPreview(quotedContent),
  ].join("\n\n");
}

/**
 * 压缩已经被模型消费过的历史消息，减少后续轮次的 prompt 体积。
 * 只保留必要的文件路径、结果摘要和少量预览，避免大段文件内容在后续轮次中重复携带。
 */
export function compactMessagesForContext(messages: BaseMessage[]): void {
  const toolCallMap = new Map<
    string,
    { name: string; args: Record<string, unknown> }
  >();
  const protectedStartIndex = getProtectedRecentStartIndex(messages);

  for (const [messageIndex, message] of messages.entries()) {
    if (isProtectedRecentMessage(messageIndex, protectedStartIndex)) {
      continue;
    }

    if (message instanceof HumanMessage && typeof message.content === "string") {
      (message as { content: string }).content = compactHumanFileContext(
        message.content
      );
      continue;
    }

    if (!(message instanceof AIMessage)) {
      continue;
    }

    const aiMessage = message as AIMessage & {
      tool_calls?: Array<{ id?: string; name: string; args: unknown }>;
      additional_kwargs?: {
        tool_calls?: Array<{
          id?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };
    };

    if (Array.isArray(aiMessage.tool_calls)) {
      aiMessage.tool_calls = aiMessage.tool_calls.map((toolCall) => {
        const compactedArgs = compactToolCallArgs(toolCall.name, toolCall.args);
        if (toolCall.id) {
          toolCallMap.set(toolCall.id, {
            name: toolCall.name,
            args: compactedArgs,
          });
        }
        return { ...toolCall, args: compactedArgs };
      });
    }

    if (Array.isArray(aiMessage.additional_kwargs?.tool_calls)) {
      aiMessage.additional_kwargs.tool_calls =
        aiMessage.additional_kwargs.tool_calls.map((toolCall, index) => {
          if (!toolCall?.function?.arguments) {
            return toolCall;
          }

          try {
            const parsedArgs = JSON.parse(toolCall.function.arguments);
            const toolName =
              toolCall.function.name || aiMessage.tool_calls?.[index]?.name || "";
            const compactedArgs = compactToolCallArgs(toolName, parsedArgs);
            if (toolCall.id) {
              toolCallMap.set(toolCall.id, {
                name: toolName,
                args: compactedArgs,
              });
            }

            return {
              ...toolCall,
              function: {
                ...toolCall.function,
                arguments: JSON.stringify(compactedArgs),
              },
            };
          } catch {
            return toolCall;
          }
        });
    }
  }

  for (const [messageIndex, message] of messages.entries()) {
    if (isProtectedRecentMessage(messageIndex, protectedStartIndex)) {
      continue;
    }

    if (!(message instanceof ToolMessage) || typeof message.content !== "string") {
      continue;
    }

    const toolInfo = toolCallMap.get((message as ToolMessage & {
      tool_call_id?: string;
    }).tool_call_id || "");
    if (!toolInfo) {
      continue;
    }

    switch (toolInfo.name) {
      case "read_file":
        (message as { content: string }).content = compactReadFileResult(
          message.content,
          typeof toolInfo.args.filePath === "string"
            ? toolInfo.args.filePath
            : undefined
        );
        break;
      case "list_directory":
        (message as { content: string }).content = compactListDirectoryResult(
          message.content,
          typeof toolInfo.args.directoryPath === "string"
            ? toolInfo.args.directoryPath
            : undefined
        );
        break;
      case "read_background_logs":
        (message as { content: string }).content = compactBackgroundLogsResult(
          message.content
        );
        break;
    }
  }
}
