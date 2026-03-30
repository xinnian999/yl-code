import {
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import {
  CONTEXT_SUMMARY_KEEP_RECENT_MESSAGES,
  MIN_SUMMARIZE_SOURCE_TOKENS,
} from "../config/context-config.ts";
import { estimateTotalTokens } from "./token-estimator.ts";
import { getSafeRecentWindowStart } from "./window.ts";

/** 消息分割结果：保留部分与待摘要部分 */
export interface SplitResult {
  /** 始终保留的系统消息 */
  systemMessage: SystemMessage;
  /** 需要摘要的中间消息 */
  toSummarize: BaseMessage[];
  /** 保留的最近消息窗口 */
  toKeep: BaseMessage[];
}

/** 查找最后一条用户消息下标 */
function findLastHumanMessageIndex(messages: BaseMessage[]): number {
  for (let index = messages.length - 1; index >= 1; index--) {
    if (messages[index] instanceof HumanMessage) {
      return index;
    }
  }

  return -1;
}

/** 构建最近需要保留的消息下标集合 */
function buildKeepIndexes(
  messages: BaseMessage[],
  lastHumanIndex: number
): Set<number> {
  const keepIndexes = new Set<number>([lastHumanIndex]);
  const recentWindowStart = getSafeRecentWindowStart(
    messages,
    Math.max(1, messages.length - CONTEXT_SUMMARY_KEEP_RECENT_MESSAGES)
  );

  for (let index = recentWindowStart; index < messages.length; index++) {
    keepIndexes.add(index);
  }

  return keepIndexes;
}

/**
 * 将消息列表分割为待摘要与保留两部分。
 * 保留规则：SystemMessage + 最后一条用户消息 + 最近尾部窗口。
 */
export function splitMessages(messages: BaseMessage[]): SplitResult | null {
  if (messages.length < 3) {
    return null;
  }

  const systemMessage = messages[0] as SystemMessage;
  const lastHumanIndex = findLastHumanMessageIndex(messages);
  if (lastHumanIndex <= 1) {
    return null;
  }

  const keepIndexes = buildKeepIndexes(messages, lastHumanIndex);
  const toSummarize = messages.filter((_, index) => {
    return index !== 0 && !keepIndexes.has(index);
  });
  const toKeep = messages.filter((_, index) => keepIndexes.has(index));

  if (toSummarize.length < 2) {
    return null;
  }
  if (estimateTotalTokens(toSummarize) < MIN_SUMMARIZE_SOURCE_TOKENS) {
    return null;
  }

  return {
    systemMessage,
    toSummarize,
    toKeep,
  };
}
