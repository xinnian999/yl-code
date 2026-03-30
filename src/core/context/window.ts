import { ToolMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { CONTEXT_COMPACT_PROTECT_RECENT_MESSAGES } from "../config/context-config.ts";

/** 计算最近需要保护的消息起始下标 */
export function getProtectedRecentStartIndex(messages: BaseMessage[]): number {
  return Math.max(1, messages.length - CONTEXT_COMPACT_PROTECT_RECENT_MESSAGES);
}

/** 判断当前消息是否属于最近保护窗口 */
export function isProtectedRecentMessage(
  messageIndex: number,
  protectedStartIndex: number
): boolean {
  return messageIndex >= protectedStartIndex;
}

/** 将最近窗口起点回退到安全边界，避免从 ToolMessage 中间截断 */
export function getSafeRecentWindowStart(
  messages: BaseMessage[],
  initialStartIndex: number
): number {
  let safeStartIndex = initialStartIndex;

  while (
    safeStartIndex > 1
    && messages[safeStartIndex] instanceof ToolMessage
  ) {
    safeStartIndex--;
  }

  return safeStartIndex;
}
