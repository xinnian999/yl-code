import {
  HumanMessage,
  AIMessage,
  SystemMessage,
  ToolMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import type { ChatOpenAI } from "@langchain/openai";
import {
  DEFAULT_MAX_TOKENS,
  CONTEXT_COMPACT_PREVIEW_CHARS,
  CONTEXT_COMPACT_THRESHOLD,
  SUMMARIZE_PROMPT,
  SUMMARIZE_THRESHOLD,
} from "../config/context-config.ts";
import { toDisplayPath } from "../path-display.ts";

export { DEFAULT_MAX_TOKENS, SUMMARIZE_THRESHOLD } from "../config/context-config.ts";

function compactPreview(text: string, maxChars = CONTEXT_COMPACT_PREVIEW_CHARS): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxChars) return normalized;
  return `${normalized.slice(0, maxChars)}...`;
}

function buildCompressedMarker(label: string, text: string): string {
  return `[已压缩${label}，原始长度 ${text.length} 字符，预览: ${compactPreview(text)}]`;
}

function compactToolCallArgs(toolName: string, rawArgs: unknown): Record<string, unknown> {
  if (!rawArgs || typeof rawArgs !== "object") return {};

  const args = { ...(rawArgs as Record<string, unknown>) };
  switch (toolName) {
    case "write_file":
      if (typeof args.content === "string" && args.content.length > CONTEXT_COMPACT_THRESHOLD) {
        args.content = buildCompressedMarker("写入内容", args.content);
      }
      break;
    case "write_file_patch":
      if (typeof args.patch === "string" && args.patch.length > CONTEXT_COMPACT_THRESHOLD) {
        args.patch = buildCompressedMarker("补丁内容", args.patch);
      }
      break;
    case "execute_command":
      if (typeof args.command === "string" && args.command.length > CONTEXT_COMPACT_THRESHOLD) {
        args.command = buildCompressedMarker("命令", args.command);
      }
      break;
  }
  return args;
}

function compactReadFileResult(content: string, filePath?: string): string {
  if (!content.startsWith("文件内容:\n")) return content;

  const body = content.slice("文件内容:\n".length);
  if (body.length <= CONTEXT_COMPACT_THRESHOLD) return content;

  const displayPath = filePath ? toDisplayPath(filePath) : "未知文件";
  return [
    `已读取文件 ${displayPath}（${body.length} 字符，内容已压缩）。`,
    `预览: ${compactPreview(body)}`,
    "如需完整内容，请重新调用 read_file。",
  ].join("\n");
}

function compactListDirectoryResult(content: string, directoryPath?: string): string {
  if (!content.startsWith("目录内容:\n")) return content;
  if (content.length <= CONTEXT_COMPACT_THRESHOLD) return content;

  const displayPath = directoryPath ? toDisplayPath(directoryPath) : "未知目录";
  return [
    `已读取目录 ${displayPath}（内容已压缩）。`,
    `预览: ${compactPreview(content.slice("目录内容:\n".length))}`,
  ].join("\n");
}

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
  const toolCallMap = new Map<string, { name: string; args: Record<string, unknown> }>();

  for (const msg of messages) {
    if (msg instanceof HumanMessage && typeof msg.content === "string") {
      (msg as any).content = compactHumanFileContext(msg.content);
      continue;
    }

    if (!(msg instanceof AIMessage)) continue;

    const msgAny = msg as any;
    if (Array.isArray(msgAny.tool_calls)) {
      msgAny.tool_calls = msgAny.tool_calls.map((toolCall: any) => {
        const compactedArgs = compactToolCallArgs(toolCall.name, toolCall.args);
        toolCallMap.set(toolCall.id, { name: toolCall.name, args: compactedArgs });
        return { ...toolCall, args: compactedArgs };
      });
    }

    if (Array.isArray(msgAny.additional_kwargs?.tool_calls)) {
      msgAny.additional_kwargs.tool_calls = msgAny.additional_kwargs.tool_calls.map((toolCall: any, index: number) => {
        if (toolCall?.function && typeof toolCall.function.arguments === "string") {
          try {
            const parsedArgs = JSON.parse(toolCall.function.arguments);
            const toolName =
              toolCall.function.name || msgAny.tool_calls?.[index]?.name || "";
            const compactedArgs = compactToolCallArgs(toolName, parsedArgs);
            toolCallMap.set(toolCall.id, { name: toolName, args: compactedArgs });
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
        }
        return toolCall;
      });
    }
  }

  for (const msg of messages) {
    if (!(msg instanceof ToolMessage) || typeof msg.content !== "string") continue;

    const toolInfo = toolCallMap.get((msg as any).tool_call_id);
    if (!toolInfo) continue;

    switch (toolInfo.name) {
      case "read_file":
        (msg as any).content = compactReadFileResult(
          msg.content,
          typeof toolInfo.args.filePath === "string" ? toolInfo.args.filePath : undefined
        );
        break;
      case "list_directory":
        (msg as any).content = compactListDirectoryResult(
          msg.content,
          typeof toolInfo.args.directoryPath === "string" ? toolInfo.args.directoryPath : undefined
        );
        break;
    }
  }
}

// ============ Token 估算 ============

/** 每条消息的固定开销（role、分隔符等） */
const MESSAGE_OVERHEAD = 4;

/**
 * 估算文本的 token 数
 * CJK 字符按 1.5 token/字符，ASCII 按 0.25 token/字符（4字符≈1token）
 */
function estimateTextTokens(text: string): number {
  let tokens = 0;
  for (const char of text) {
    tokens += char.charCodeAt(0) > 0x7f ? 1.5 : 0.25;
  }
  return Math.ceil(tokens);
}

/** 估算单条消息的 token 数（含 content + tool_calls 元数据） */
export function estimateMessageTokens(message: BaseMessage): number {
  const content =
    typeof message.content === "string"
      ? message.content
      : JSON.stringify(message.content);

  let tokens = estimateTextTokens(content) + MESSAGE_OVERHEAD;

  // AIMessage 的 tool_calls 元数据也会消耗 token
  const msgAny = message as any;
  if (msgAny.tool_calls?.length > 0) {
    const toolCallsJson = JSON.stringify(msgAny.tool_calls);
    tokens += estimateTextTokens(toolCallsJson);
  }

  return tokens;
}

/** 估算消息列表的总 token 数 */
export function estimateTotalTokens(messages: BaseMessage[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateMessageTokens(msg);
  }
  return total;
}

// ============ 消息分割 ============

/** 分割结果：保留部分 + 待摘要部分 */
export interface SplitResult {
  /** 始终保留的系统消息（index 0） */
  systemMessage: SystemMessage;
  /** 需要摘要的中间消息 */
  toSummarize: BaseMessage[];
  /** 保留的最近一轮对话（从最后一个 HumanMessage 起） */
  toKeep: BaseMessage[];
}

/**
 * 将消息列表分割为待摘要和保留两部分
 * 保留规则：SystemMessage（index 0）+ 最近一轮完整对话
 * 最近一轮 = 最后一个 HumanMessage 及其后的所有消息
 */
export function splitMessages(messages: BaseMessage[]): SplitResult | null {
  if (messages.length < 3) return null;

  const systemMessage = messages[0] as SystemMessage;

  // 找到最后一个 HumanMessage 的位置
  let lastHumanIndex = -1;
  for (let i = messages.length - 1; i >= 1; i--) {
    if (messages[i] instanceof HumanMessage) {
      lastHumanIndex = i;
      break;
    }
  }

  // 只有一轮对话或没有用户消息，不需要摘要
  if (lastHumanIndex <= 1) return null;

  const toSummarize = messages.slice(1, lastHumanIndex);
  const toKeep = messages.slice(lastHumanIndex);

  // 待摘要部分太短则跳过
  if (toSummarize.length < 2) return null;

  return { systemMessage, toSummarize, toKeep };
}

// ============ 摘要生成 ============

/** 获取消息角色标签 */
function getMessageRole(msg: BaseMessage): string {
  if (msg instanceof HumanMessage) return "用户";
  if (msg instanceof AIMessage) return "助手";
  if (msg instanceof ToolMessage) return "工具结果";
  if (msg instanceof SystemMessage) return "系统";
  return "未知";
}

/** 将消息列表格式化为可读文本，供 LLM 做摘要 */
function formatMessagesForSummary(messages: BaseMessage[]): string {
  return messages
    .map((msg) => {
      const content =
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content);
      return `[${getMessageRole(msg)}]: ${content}`;
    })
    .join("\n\n");
}

/**
 * 调用 LLM 生成对话摘要
 * 使用不绑定工具的裸模型实例，避免工具调用开销
 */
export async function generateSummary(
  model: ChatOpenAI,
  messagesToSummarize: BaseMessage[]
): Promise<string> {
  const formatted = formatMessagesForSummary(messagesToSummarize);
  const response = await model.invoke([
    new HumanMessage(`${SUMMARIZE_PROMPT}\n\n---\n\n${formatted}`),
  ]);
  return typeof response.content === "string"
    ? response.content
    : JSON.stringify(response.content);
}

/**
 * 将摘要文本构建为标准消息对（HumanMessage + AIMessage）
 * 维持消息交替规则，避免连续两个同类型消息
 */
export function buildSummaryMessages(
  summaryText: string
): [HumanMessage, AIMessage] {
  return [
    new HumanMessage(`[对话历史摘要]\n${summaryText}`),
    new AIMessage("好的，我已了解之前的对话内容，请继续。"),
  ];
}
