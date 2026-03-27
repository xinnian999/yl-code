/**
 * Agent 模型管理模块 - 创建模型实例和上下文压缩
 */
import { ChatOpenAI } from "@langchain/openai";
import { getToolsForMode } from "./tools.ts";
import type { ModeTool } from "./tools.ts";
import { ThinkingStatus } from "./types.ts";
import type { AgentModeValue } from "./types.ts";
import type { ConfigManager } from "./config.ts";
import type { MessageBus } from "./message-bus.ts";
import type { AgentContext } from "./agent-helpers.ts";
import { SUMMARIZE_THRESHOLD } from "./config/context-config.ts";
import {
  estimateTotalTokens,
  splitMessages,
  generateSummary,
  buildSummaryMessages,
} from "./context/context-manager.ts";

/** 创建绑定工具的模型实例（根据当前模式筛选工具） */
export function createBoundModel(
  config: ConfigManager,
  tools: ModeTool[],
  mode: AgentModeValue,
  debugMode: boolean,
  messageBus: MessageBus
): ReturnType<ChatOpenAI["bindTools"]> {
  const modelConfig = config.getCurrentModel();
  const llm = new ChatOpenAI({
    modelName: modelConfig.modelName,
    apiKey: modelConfig.apiKey,
    temperature: 0,
    timeout: 300000,
    maxRetries: 0,
    configuration: { baseURL: modelConfig.baseUrl },
  });
  const filteredTools = getToolsForMode(tools, mode);
  const bound = llm.bindTools(filteredTools);

  if (debugMode) {
    messageBus.ai("");
    messageBus.appendDebugToLastBlock(JSON.stringify({
      model: modelConfig.modelName,
      baseURL: modelConfig.baseUrl,
      tools: filteredTools.map((t) => t.name),
    }, null, 2));
  }

  return bound;
}

/** 创建不绑定工具的裸模型实例（用于摘要生成） */
export function createBareModel(config: ConfigManager): ChatOpenAI {
  const modelConfig = config.getCurrentModel();
  return new ChatOpenAI({
    modelName: modelConfig.modelName,
    apiKey: modelConfig.apiKey,
    temperature: 0,
    timeout: 60000,
    maxRetries: 1,
    configuration: { baseURL: modelConfig.baseUrl },
  });
}

/**
 * 检查 token 用量，必要时触发上下文压缩
 * 更新 contextBus 使 UI 显示最新百分比
 */
export async function checkAndSummarize(ctx: AgentContext): Promise<void> {
  const tokens = estimateTotalTokens(ctx.chatMessages);
  ctx.contextBus.updateUsage(tokens);

  if (tokens < SUMMARIZE_THRESHOLD) return;

  const split = splitMessages(ctx.chatMessages);
  if (!split) return;

  ctx.contextBus.notifySummarizing();
  ctx.messageBus.setThinkingStatus(ThinkingStatus.THINKING, "正在压缩上下文...");

  try {
    const bareModel = createBareModel(ctx.config);
    const summaryText = await generateSummary(bareModel, split.toSummarize);
    const [summaryHuman, summaryAI] = buildSummaryMessages(summaryText);

    ctx.chatMessages = [
      split.systemMessage,
      summaryHuman,
      summaryAI,
      ...split.toKeep,
    ];

    const newTokens = estimateTotalTokens(ctx.chatMessages);
    ctx.contextBus.updateUsage(newTokens);
    ctx.contextBus.notifySummarized();

    if (ctx.debugMode) {
      ctx.messageBus.appendDebugToLastBlock(
        `上下文已压缩: ${tokens} → ${newTokens} tokens, ${split.toSummarize.length} 条消息已摘要`
      );
    }
  } catch (error) {
    if (ctx.debugMode) {
      const err = error as Error;
      ctx.messageBus.appendDebugToLastBlock(`上下文压缩失败: ${err.message}`);
    }
  }
}
