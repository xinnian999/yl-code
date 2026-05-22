import { ThinkingStatus } from "../../../types.ts";
import { SUMMARIZE_THRESHOLD } from "../../../config/context-config.ts";
import { estimateTotalTokens } from "../../../context/token-estimator.ts";
import { splitMessages } from "../../../context/message-splitter.ts";
import {
  generateSummary,
  buildSummaryMessages,
} from "../../../context/summary.ts";
import { createBareModel } from "../../model.ts";
import type { AgentGraphState } from "../state.ts";
import type { AgentGraphDeps } from "../deps.ts";

/** 执行一次摘要压缩并替换 messages 内容（保持引用） */
async function summarizeAndReplace(
  state: AgentGraphState,
  deps: AgentGraphDeps
): Promise<void> {
  const split = splitMessages(state.messages);
  if (!split) return;

  deps.contextBus.notifySummarizing();
  deps.messageBus.setThinkingStatus(
    ThinkingStatus.THINKING,
    "正在压缩上下文..."
  );

  try {
    const bareModel = createBareModel(deps.config);
    const summaryText = await generateSummary(bareModel, split.toSummarize);
    const [summaryHuman, summaryAI] = buildSummaryMessages(summaryText);

    state.messages.length = 0;
    state.messages.push(
      split.systemMessage,
      summaryHuman,
      summaryAI,
      ...split.toKeep
    );

    deps.contextBus.updateUsage(estimateTotalTokens(state.messages));
    deps.contextBus.notifySummarized();
  } catch (error) {
    if (deps.isDebugMode()) {
      const err = error as Error;
      deps.messageBus.appendDebugToLastBlock(
        `上下文压缩失败: ${err.message}`
      );
    }
  }
}

/**
 * 上下文压缩节点：在每次工具调用后检查 token 用量，
 * 必要时摘要压缩历史消息。
 */
export function createCompactionNode(deps: AgentGraphDeps) {
  return async (state: AgentGraphState): Promise<Partial<AgentGraphState>> => {
    const tokens = estimateTotalTokens(state.messages);
    deps.contextBus.updateUsage(tokens);

    if (tokens >= SUMMARIZE_THRESHOLD) {
      await summarizeAndReplace(state, deps);
    }

    deps.refreshSystemPrompt();
    return { messages: state.messages };
  };
}
