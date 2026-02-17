/**
 * Agent 会话和模型管理模块 - 斜杠命令、模型增删改、文件引用解析、会话生命周期
 */
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { parseAtReferences, getFileContent } from "./file-scanner.ts";
import { join } from "path";
import type { ModelConfig, AgentModeValue } from "./types.ts";
import type { ConfigManager } from "./config.ts";
import type { MessageBus } from "./message-bus.ts";
import type { SessionManager } from "./session/session-manager.ts";
import type { ConfirmBus } from "./confirm-bus.ts";
import type { TodoBus } from "./todo-bus.ts";
import type { ContextBus } from "./context/context-bus.ts";
import { HELP_TEXT, type CommandAction } from "./commands.ts";
import { buildSystemPrompt } from "./agent-helpers.ts";
import { estimateTotalTokens } from "./context/context-manager.ts";

// ============ 文件引用 ============

/** 从用户输入中解析 @ 引用并构建文件上下文 */
export function buildFileContext(query: string): string {
  const atRefs = parseAtReferences(query);
  if (atRefs.length === 0) return "";

  const contents = atRefs.map((ref) => {
    const fullPath = join(process.cwd(), ref);
    return `--- 文件: ${ref} ---\n${getFileContent(fullPath)}\n--- 文件结束 ---`;
  });
  return "\n\n" + contents.join("\n\n");
}

/** 获取第一条用户消息内容（用于会话标题） */
export function getFirstUserMessage(chatMessages: BaseMessage[]): string {
  for (const msg of chatMessages) {
    if (msg instanceof HumanMessage) {
      return typeof msg.content === "string" ? msg.content : "";
    }
  }
  return "";
}

// ============ 模型管理 ============

/** 添加模型配置并自动切换 */
export function addModel(
  config: ConfigManager,
  notify: (msg: string) => void,
  data: { name: string; baseUrl: string; apiKey: string; modelName: string }
): void {
  const newModel: ModelConfig = {
    id: `model_${Date.now()}`,
    name: data.name,
    baseUrl: data.baseUrl,
    apiKey: data.apiKey,
    modelName: data.modelName,
  };
  config.addModel(newModel);
  config.setCurrentModel(newModel.id);
  notify(`✅ 模型 "${data.name}" 添加成功，已自动切换`);
}

/** 更新模型配置 */
export function updateModel(
  config: ConfigManager,
  notify: (msg: string) => void,
  modelId: string,
  data: { name: string; baseUrl: string; apiKey: string; modelName: string }
): void {
  config.updateModel(modelId, data);
  notify(`✅ 模型 "${data.name}" 更新成功`);
}

/** 删除模型配置（不能删除当前使用的模型） */
export function removeModel(
  config: ConfigManager,
  notify: (msg: string) => void,
  modelId: string
): boolean {
  if (modelId === config.getCurrentModelId()) {
    notify("⚠️ 不能删除当前正在使用的模型，请先切换到其他模型");
    return false;
  }
  const model = config.getModels().find((m) => m.id === modelId);
  config.removeModel(modelId);
  notify(`✅ 模型 "${model?.name}" 已删除`);
  return true;
}

// ============ 斜杠命令 ============

/** 斜杠命令上下文，提供命令执行所需的回调 */
export interface CommandContext {
  /** 新建会话 */
  newSession: () => void;
  /** 调试模式开关 */
  debugMode: boolean;
  /** 设置调试模式 */
  setDebugMode: (value: boolean) => void;
  /** 消息总线 */
  messageBus: MessageBus;
}

/** 执行斜杠命令，返回 UI 需要响应的动作 */
export function executeCommand(command: string, ctx: CommandContext): CommandAction {
  switch (command) {
    case "new":
    case "clear":
      ctx.newSession();
      return { action: "none" };
    case "history":
      return { action: "show_history" };
    case "model":
      return { action: "select_model" };
    case "mcp":
      return { action: "manage_mcp" };
    case "debug":
      ctx.setDebugMode(!ctx.debugMode);
      ctx.messageBus.createAIMessage();
      ctx.messageBus.ai(!ctx.debugMode ? "🐛 调试模式已开启" : "🐛 调试模式已关闭");
      return { action: "none" };
    case "help":
      ctx.messageBus.createAIMessage();
      ctx.messageBus.ai(HELP_TEXT);
      return { action: "none" };
    case "exit":
      ctx.messageBus.ai("👋 再见！");
      return { action: "exit" };
    default:
      return { action: "none" };
  }
}

// ============ 会话生命周期 ============

/** 会话管理所需的上下文 */
export interface SessionContext {
  chatMessages: BaseMessage[];
  readonly messageBus: MessageBus;
  readonly confirmBus: ConfirmBus;
  readonly todoBus: TodoBus;
  readonly contextBus: ContextBus;
  readonly sessionManager: SessionManager;
  mode: AgentModeValue;
  systemTemplate: string;
  /** 清空对话历史 */
  clearMemory: () => void;
}

/** 保存当前会话到磁盘 */
export function saveSession(ctx: SessionContext): void {
  ctx.sessionManager.saveCurrentSession(
    ctx.chatMessages, ctx.messageBus.getMessages(), getFirstUserMessage(ctx.chatMessages)
  );
}

/** 恢复指定会话（保存当前 → 加载目标 → 恢复状态） */
export function restoreSession(ctx: SessionContext, sessionId: string): boolean {
  saveSession(ctx);
  const data = ctx.sessionManager.switchToSession(sessionId);
  if (!data) return false;
  ctx.chatMessages = data.chatMessages;
  // 更新系统提示词
  const systemPrompt = buildSystemPrompt(ctx.systemTemplate, ctx.mode);
  if (ctx.chatMessages.length > 0) ctx.chatMessages[0] = new SystemMessage(systemPrompt);
  ctx.contextBus.updateUsage(estimateTotalTokens(ctx.chatMessages));
  ctx.messageBus.restoreMessages(data.uiMessages);
  ctx.confirmBus.resetSession();
  return true;
}

/** 开始新对话会话（保存当前 → 新建空白） */
export function newSession(ctx: SessionContext): void {
  saveSession(ctx);
  ctx.sessionManager.startNewSession();
  ctx.clearMemory();
  ctx.messageBus.clearMessages();
  ctx.confirmBus.resetSession();
  ctx.todoBus.clearTodos();
  ctx.contextBus.reset();
  ctx.messageBus.createAIMessage();
  ctx.messageBus.ai("🧹 已开启新对话");
}
