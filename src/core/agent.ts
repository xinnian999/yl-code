import "dotenv/config";
import type { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { PromptTemplate } from'@langchain/core/prompts';
import { createTools } from "./tools.ts";
import type { ModeTool } from "./tools.ts";
import { MessageBus } from "./message-bus.ts";
import { ConfirmBus } from "./confirm-bus.ts";
import { ConfigManager } from "./config.ts";
import { ProcessManager } from "./process-manager.ts";
import { TodoBus } from "./todo-bus.ts";
import { ContextBus } from "./context/context-bus.ts";
import { estimateTotalTokens } from "./context/context-manager.ts";
import { AgentMode, ThinkingStatus } from "./types.ts";
import type { ModelConfig, AgentModeValue } from "./types.ts";
import type { CommandAction } from "./commands.ts";
import { SessionManager } from "./session/session-manager.ts";
import { McpConfigManager, McpManager } from "./mcp/index.ts";
import { loadSystemTemplate, buildSystemPrompt, formatDuration } from "./agent-helpers.ts";
import { createBoundModel, checkAndSummarize } from "./agent-model.ts";
import { streamModelResponse } from "./agent-stream.ts";
import { executeToolCalls, normalizeResponse, handleApiError } from "./agent-tools.ts";
import {
  buildFileContext,
  addModel as addModelFn,
  updateModel as updateModelFn,
  removeModel as removeModelFn,
  executeCommand as executeCommandFn,
  saveSession as saveSessionFn,
  restoreSession as restoreSessionFn,
  newSession as newSessionFn,
} from "./agent-session.ts";

/** 欢迎消息文本 */
const WELCOME_MESSAGE = `您好老板！\n\n我是一个会写代码的《牛码》；\n\n有什么可以为您效劳的？😊`;

/**
 * Agent 核心类 - 管理对话、工具调用和子系统
 */
export class Agent {
  /** 消息总线 */
  readonly messageBus = new MessageBus();
  /** 确认总线 */
  readonly confirmBus = new ConfirmBus();
  /** 任务总线 */
  readonly todoBus = new TodoBus();
  /** 上下文总线 */
  readonly contextBus = new ContextBus();
  /** 配置管理器 */
  readonly config = new ConfigManager();
  /** 会话管理器 */
  readonly sessionManager = new SessionManager();
  /** MCP 配置管理器 */
  readonly mcpConfig = new McpConfigManager();
  /** MCP 连接管理器 */
  readonly mcpManager = new McpManager(this.mcpConfig);
  /** 后台进程管理器 */
  private processManager = new ProcessManager();

  /** 对话消息历史 */
  chatMessages: BaseMessage[];
  /** 当前绑定工具的模型实例 */
  private currentModel: ReturnType<ChatOpenAI["bindTools"]> | null = null;
  /** 系统提示词原始模板 */
  systemTemplate: string;
  /** 内置工具列表（不含 MCP） */
  private builtinTools: ModeTool[];
  /** 合并后的工具列表（内置 + MCP） */
  tools: ModeTool[];
  /** 当前工作模式 */
  mode: AgentModeValue = AgentMode.BUILD;
  /** 模型变更事件的取消订阅函数 */
  private unsubModelChange: () => void;
  /** 中断控制器 */
  private abortController: AbortController | null = null;
  /** 调试模式开关 */
  debugMode = false;

  constructor() {
    this.systemTemplate = loadSystemTemplate();
    this.chatMessages = [new SystemMessage(buildSystemPrompt(this.systemTemplate, this.mode))];
    this.builtinTools = createTools(this.confirmBus, this.processManager, this.todoBus);
    this.tools = [...this.builtinTools];
    this.unsubModelChange = this.config.onModelChange(() => { this.currentModel = null; });
    this.messageBus.ai(WELCOME_MESSAGE);
  }

  /** 获取或创建绑定工具的模型实例 */
  private getModel() {
    if (!this.currentModel) {
      this.currentModel = createBoundModel(this.config, this.tools, this.mode, this.debugMode, this.messageBus);
    }
    return this.currentModel;
  }

  /** 获取调试模式状态 */
  isDebugMode(): boolean { return this.debugMode; }

  /** 中断当前正在进行的 AI 请求 */
  abort(): void { this.abortController?.abort(); }

  /** 清空对话历史，仅保留系统提示词 */
  clearMemory(): void {
    this.chatMessages.length = 0;
    this.chatMessages.push(new SystemMessage(buildSystemPrompt(this.systemTemplate, this.mode)));
    this.contextBus.reset();
  }

  /** 异步初始化（启动时调用，静默连接 MCP 服务器） */
  async init(): Promise<void> {
    const servers = this.mcpConfig.getEnabledServers();
    if (servers.length === 0) return;

    await this.mcpManager.initialize();
    this.refreshTools();
  }

  /** 合并内置工具和 MCP 工具，重置模型绑定 */
  private refreshTools(): void {
    const mcpTools: ModeTool[] = this.mcpManager.getTools().map((tool) => ({
      tool,
      modes: [AgentMode.BUILD],
    }));
    this.tools = [...this.builtinTools, ...mcpTools];
    this.currentModel = null;
  }

  /** 重新连接 MCP 服务器并刷新工具（供 UI 调用） */
  async reconnectMcp(): Promise<void> {
    this.messageBus.setThinkingStatus(ThinkingStatus.THINKING, "正在重连 MCP 服务器...");
    await this.mcpManager.reconnect();
    this.refreshTools();
    this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
  }

  /** 输出本轮耗时和 token 统计 */
  private reportStats(startTime: number, startTokens: number): void {
    const totalDuration = Date.now() - startTime - this.confirmBus.totalWaitTime;
    const usedTokens = estimateTotalTokens(this.chatMessages) - startTokens;
    this.messageBus.setLastAITotalDuration(totalDuration);
    this.messageBus.setLastAITokenUsage(usedTokens / 1000);
  }

  /** 执行一次对话，支持多轮工具调用 */
  async run(query: string, fileContext = "", maxIterations = 30): Promise<string> {
    const startTime = Date.now();
    const startTokens = estimateTotalTokens(this.chatMessages);
    this.abortController = new AbortController();
    this.confirmBus.resetSkipConfirm();

    const durationTimer = setInterval(() => {
      const wait = this.confirmBus.getCurrentWaitTime();
      const elapsed = Date.now() - startTime - wait;
      if (elapsed >= 0) {
        this.messageBus.setLastAITotalDuration(elapsed);
      }
    }, 100);

    let messageContent = query;
    if (fileContext) {
      messageContent = `${query}\n\n【用户引用的文件内容如下，请根据这些内容完成任务】${fileContext}`;
    }

    try {
      await checkAndSummarize(this);
      this.chatMessages.push(new HumanMessage(messageContent));
      const aiMessage = this.messageBus.createAIMessage();
      this.todoBus.setCurrentMessageId(aiMessage.id);

      for (let i = 0; i < maxIterations; i++) {
        if (this.abortController.signal.aborted) { this.messageBus.ai("\n⚠️ 已中断"); break; }

        const iterationStartTime = Date.now();
        this.messageBus.setThinkingStatus(ThinkingStatus.THINKING, "玩命思考中...🐂🐎");

        let response: any;
        try {
          response = await streamModelResponse(
            this.messageBus, this.debugMode, this.getModel(), this.chatMessages, this.abortController.signal
          );
        } catch (error) {
          if (this.abortController.signal.aborted) { this.messageBus.ai("\n⚠️ 已中断"); break; }
          this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
          handleApiError(this.config, error);
        }

        this.chatMessages.push(normalizeResponse(response));

        if (!response.tool_calls || response.tool_calls.length === 0) break;

        await executeToolCalls(this, response, iterationStartTime);
        if (i > 0) await checkAndSummarize(this);
        if (this.abortController.signal.aborted) { this.messageBus.ai("\n⚠️ 已中断"); break; }
        this.messageBus.setThinkingStatus(ThinkingStatus.WAITING, "等待 AI 响应...");
      }

      this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
      if (!this.abortController?.signal.aborted) this.todoBus.completeAll();
      this.reportStats(startTime, startTokens);

      const lastMessage = this.chatMessages[this.chatMessages.length - 1];
      return typeof lastMessage.content === "string" ? lastMessage.content : "";
    } finally {
      clearInterval(durationTimer);
    }
  }

  /** 完整对话入口：解析文件引用 → 发送消息 → 调用 AI → 处理错误 */
  async chat(query: string): Promise<void> {
    this.messageBus.user(query);
    try {
      await this.run(query, buildFileContext(query));
    } catch (error) {
      this.messageBus.createAIMessage();
      this.messageBus.error((error as Error)?.message || String(error));
    } finally {
      this.abortController = null;
      this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
      this.saveSession();
    }
  }

  /** 执行斜杠命令 */
  executeCommand(command: string): CommandAction {
    return executeCommandFn(command, {
      newSession: () => this.newSession(),
      debugMode: this.debugMode,
      setDebugMode: (v) => { this.debugMode = v; },
      messageBus: this.messageBus,
    });
  }

  /** 切换当前模型 */
  switchModel(model: ModelConfig): void {
    this.config.setCurrentModel(model.id);
    this.notify(`✅ 已切换到: ${model.name}`);
  }

  /** 添加模型配置 */
  addModel(data: { name: string; baseUrl: string; apiKey: string; modelName: string }): void {
    addModelFn(this.config, this.notify.bind(this), data);
  }

  /** 更新模型配置 */
  updateModel(modelId: string, data: { name: string; baseUrl: string; apiKey: string; modelName: string }): void {
    updateModelFn(this.config, this.notify.bind(this), modelId, data);
  }

  /** 删除模型配置 */
  removeModel(modelId: string): boolean {
    return removeModelFn(this.config, this.notify.bind(this), modelId);
  }

  /** 获取所有模型配置 */
  getModels(): ModelConfig[] { return this.config.getModels(); }

  /** 获取当前模型 ID */
  getCurrentModelId(): string { return this.config.getCurrentModelId(); }

  /** 发送系统通知消息 */
  notify(message: string): void { this.messageBus.createAIMessage(); this.messageBus.ai(message); }

  /** 获取当前工作模式 */
  getMode(): AgentModeValue { return this.mode; }

  /** 设置工作模式 */
  setMode(mode: AgentModeValue): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.currentModel = null;
    const systemPrompt = buildSystemPrompt(this.systemTemplate, this.mode);
    if (this.chatMessages.length > 0) this.chatMessages[0] = new SystemMessage(systemPrompt);
  }

  /** 保存当前会话 */
  saveSession(): void { saveSessionFn(this); }

  /** 恢复指定会话 */
  restoreSession(sessionId: string): boolean { return restoreSessionFn(this, sessionId); }

  /** 开始新对话会话 */
  newSession(): void { newSessionFn(this); }

  /** 清理后台进程 */
  cleanup(): void { this.processManager.cleanup(); }

  /** 释放资源 */
  dispose(): void {
    this.saveSession();
    this.unsubModelChange();
    this.mcpManager.close().catch(() => {});
  }
}
