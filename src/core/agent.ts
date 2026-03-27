import "dotenv/config";
import type { ChatOpenAI } from "@langchain/openai";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createTools } from "./tools.ts";
import type { ModeTool } from "./tools.ts";
import { MessageBus } from "./message-bus.ts";
import { ConfirmBus } from "./confirm-bus.ts";
import { ConfigManager } from "./config.ts";
import { ProcessManager } from "./process-manager.ts";
import { TodoBus } from "./todo-bus.ts";
import { ContextBus } from "./context/context-bus.ts";
import { PlanBus } from "./plan/plan-bus.ts";
import {
  buildPlanInteractionContent,
  buildPlanPreviewSummary,
  buildPlanQuestionSummary,
  parsePlanInteraction,
  parsePlanInteractionFromToolCalls,
} from "./plan/plan-parser.ts";
import {
  estimateTotalTokens,
  compactMessagesForContext,
} from "./context/context-manager.ts";
import { AgentMode, ThinkingStatus } from "./types.ts";
import type { ModelConfig, AgentModeValue } from "./types.ts";
import type { CommandAction } from "./commands.ts";
import {
  AGENT_DEFAULT_DEBUG_MODE,
  AGENT_DEFAULT_MODE,
  AGENT_DEFAULT_STREAM_ENABLED,
  AGENT_API_MAX_ATTEMPTS,
  AGENT_API_RETRY_BASE_DELAY_MS,
  AGENT_API_RETRY_MAX_DELAY_MS,
  AGENT_DURATION_UPDATE_INTERVAL_MS,
  AGENT_MAX_ITERATIONS,
  AGENT_STATUS_TEXT,
  AGENT_WELCOME_MESSAGE,
} from "./config/agent-config.ts";
import { SessionManager } from "./session/session-manager.ts";
import { McpConfigManager, McpManager } from "./mcp/index.ts";
import { loadSystemTemplate, buildSystemPrompt } from "./agent-helpers.ts";
import { createBoundModel, checkAndSummarize } from "./agent-model.ts";
import {
  getModelRetryDecision,
  waitForRetryDelay,
} from "./agent-retry.ts";
import { invokeModelResponse, streamModelResponse } from "./agent-stream.ts";
import {
  executeToolCalls,
  normalizeResponse,
  normalizeResponseToolCalls,
  handleApiError,
} from "./agent-tools.ts";
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

/**
 * Agent 核心类 - 管理对话、工具调用和子系统
 */
export class Agent {
  /** 消息总线 */
  readonly messageBus = new MessageBus();
  /** 确认总线 */
  readonly confirmBus = new ConfirmBus();
  /** 计划交互总线 */
  readonly planBus = new PlanBus();
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
  mode: AgentModeValue = AGENT_DEFAULT_MODE;
  /** 模型变更事件的取消订阅函数 */
  private unsubModelChange: () => void;
  /** 中断控制器 */
  private abortController: AbortController | null = null;
  /** 调试模式开关 */
  debugMode = AGENT_DEFAULT_DEBUG_MODE;
  /** 流式输出开关 */
  streamEnabled = AGENT_DEFAULT_STREAM_ENABLED;
  /** 模式变更监听器 */
  private modeListeners = new Set<(mode: AgentModeValue) => void>();

  constructor() {
    this.systemTemplate = loadSystemTemplate();
    this.chatMessages = [new SystemMessage(buildSystemPrompt(this.systemTemplate, this.mode))];
    this.builtinTools = createTools(this.confirmBus, this.processManager, this.todoBus);
    this.tools = [...this.builtinTools];
    this.unsubModelChange = this.config.onModelChange(() => { this.currentModel = null; });
    this.messageBus.ai(AGENT_WELCOME_MESSAGE);
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

  /** 获取流式输出状态 */
  isStreamEnabled(): boolean { return this.streamEnabled; }

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
    this.messageBus.setThinkingStatus(ThinkingStatus.THINKING, AGENT_STATUS_TEXT.RECONNECTING_MCP);
    await this.mcpManager.reconnect();
    this.refreshTools();
    this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
  }

  /** 输出本轮耗时和 token 统计 */
  private reportStats(startTime: number, startTokens: number): void {
    const totalDuration = Date.now()
      - startTime
      - this.confirmBus.totalWaitTime
      - this.planBus.totalWaitTime;
    const usedTokens = estimateTotalTokens(this.chatMessages) - startTokens;
    this.messageBus.setLastAITotalDuration(totalDuration);
    this.messageBus.setLastAITokenUsage(usedTokens / 1000);
  }

  /** 创建新的 AI 消息并绑定当前任务列表 */
  private beginAssistantTurn(): void {
    const aiMessage = this.messageBus.createAIMessage();
    this.todoBus.setCurrentMessageId(aiMessage.id);
  }

  /** 提取模型响应中的文本内容 */
  private getResponseContent(response: any): string {
    if (typeof response?.content === "string") return response.content;
    if (!response?.content) return "";
    return JSON.stringify(response.content);
  }

  /** 按当前模式执行一次模型请求 */
  private async invokeModelOnce(signal: AbortSignal): Promise<any> {
    if (this.mode === AgentMode.PLAN) {
      const response = await this.getModel().invoke(this.chatMessages, { signal });
      this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
      return response;
    }

    return this.streamEnabled
      ? await streamModelResponse(
          this.messageBus,
          this.debugMode,
          this.getModel(),
          this.chatMessages,
          signal
        )
      : await invokeModelResponse(
          this.messageBus,
          this.debugMode,
          this.getModel(),
          this.chatMessages,
          signal
        );
  }

  /** 在临时性平台错误下自动重试模型请求 */
  private async invokeModelWithRetry(): Promise<any> {
    const signal = this.abortController?.signal;
    if (!signal) {
      throw new Error("模型请求尚未初始化");
    }

    for (let attempt = 1; attempt <= AGENT_API_MAX_ATTEMPTS; attempt++) {
      try {
        return await this.invokeModelOnce(signal);
      } catch (error) {
        const retryDecision = getModelRetryDecision(error, attempt, {
          maxAttempts: AGENT_API_MAX_ATTEMPTS,
          baseDelayMs: AGENT_API_RETRY_BASE_DELAY_MS,
          maxDelayMs: AGENT_API_RETRY_MAX_DELAY_MS,
        });

        if (!retryDecision.shouldRetry) {
          throw error;
        }

        const retryIndex = attempt;
        const totalRetries = AGENT_API_MAX_ATTEMPTS - 1;
        const delaySeconds = Math.max(1, Math.ceil(retryDecision.delayMs / 1000));
        this.messageBus.warning(
          `模型服务暂时不可用（${retryDecision.reason}），正在自动重试（${retryIndex}/${totalRetries}），约 ${delaySeconds} 秒后继续。`
        );
        this.messageBus.setThinkingStatus(
          ThinkingStatus.THINKING,
          `模型暂时不可用，正在自动重试（${retryIndex}/${totalRetries}）...`
        );
        await waitForRetryDelay(retryDecision.delayMs, signal);
      }
    }

    throw new Error("模型请求重试失败");
  }

  /** 给计划模式的占位文本附加调试信息 */
  private appendPlanDebug(rawContent: string): void {
    if (!this.debugMode) return;
    this.messageBus.appendDebugToLastBlock(
      JSON.stringify({ planModeRawContent: rawContent }, null, 2)
    );
  }

  /** 清空响应中的工具调用，避免误进入真实工具执行链路 */
  private clearResponseToolCalls(response: any): void {
    response.tool_calls = [];
    if (Array.isArray(response?.additional_kwargs?.tool_calls)) {
      response.additional_kwargs.tool_calls = [];
    }
  }

  /** 归一化计划模式响应，兼容模型误输出的计划伪工具调用 */
  private normalizePlanResponse(response: any): void {
    const content = this.getResponseContent(response).trim();
    const parsedFromContent = parsePlanInteraction(content);
    if (parsedFromContent) {
      this.clearResponseToolCalls(response);
      return;
    }

    const parsedFromToolCalls = parsePlanInteractionFromToolCalls(
      Array.isArray(response?.tool_calls) ? response.tool_calls : []
    );
    if (!parsedFromToolCalls) {
      return;
    }

    const interactionContent = buildPlanInteractionContent(parsedFromToolCalls);
    response.content = content ? `${content}\n\n${interactionContent}` : interactionContent;
    this.clearResponseToolCalls(response);
  }

  /** 推进计划模式中的追问回答 */
  private continuePlanConversation(displayText: string, answer: string): void {
    this.messageBus.user(displayText);
    this.chatMessages.push(new HumanMessage(answer));
    this.beginAssistantTurn();
  }

  /** 处理计划模式下的结构化提问 */
  private async handlePlanQuestion(content: string): Promise<"continue"> {
    const parsedInteraction = parsePlanInteraction(content);
    if (!parsedInteraction || parsedInteraction.type !== "question") {
      return "continue";
    }

    this.messageBus.ai(buildPlanQuestionSummary(parsedInteraction.data));
    this.appendPlanDebug(content);

    const answer = await this.planBus.requestQuestion(parsedInteraction.data);
    this.continuePlanConversation(answer.displayText, answer.answer);
    return "continue";
  }

  /** 处理计划模式下的计划预览 */
  private async handlePlanPreview(content: string): Promise<"continue" | "break"> {
    const parsedInteraction = parsePlanInteraction(content);
    if (!parsedInteraction || parsedInteraction.type !== "preview") {
      return "break";
    }

    const { title, planMarkdown } = parsedInteraction.data;
    this.messageBus.ai(buildPlanPreviewSummary(title));
    this.appendPlanDebug(content);

    const result = await this.planBus.requestPlanPreview(title, planMarkdown);
    if (result.action === "cancel") {
      return "break";
    }

    if (result.action === "execute") {
      this.messageBus.user("确认执行当前计划");
      this.chatMessages.push(
        new HumanMessage("我已确认当前计划，请立即切换到执行阶段并开始实现。")
      );
      this.setMode(AgentMode.BUILD);
      this.beginAssistantTurn();
      return "continue";
    }

    this.continuePlanConversation(
      `修改计划：${result.feedback}`,
      `请根据以下意见修改计划，并只输出新的 <proposed_plan>：\n${result.feedback}`
    );
    return "continue";
  }

  /** 处理计划模式下的模型文本响应 */
  private async handlePlanModeResponse(response: any): Promise<"continue" | "break"> {
    const content = this.getResponseContent(response).trim();
    if (!content) {
      return response.tool_calls?.length > 0 ? "continue" : "break";
    }

    const parsedInteraction = parsePlanInteraction(content);
    if (!parsedInteraction) {
      this.messageBus.ai(content);
      this.appendPlanDebug(content);
      return response.tool_calls?.length > 0 ? "continue" : "break";
    }

    if (parsedInteraction.type === "question") {
      return this.handlePlanQuestion(content);
    }
    return this.handlePlanPreview(content);
  }

  /** 通知所有模式监听器 */
  private notifyModeChange(): void {
    for (const listener of this.modeListeners) {
      listener(this.mode);
    }
  }

  /** 监听模式变更 */
  onModeChange(listener: (mode: AgentModeValue) => void): () => void {
    this.modeListeners.add(listener);
    return () => {
      this.modeListeners.delete(listener);
    };
  }

  /** 执行一次对话，支持多轮工具调用 */
  async run(
    query: string,
    fileContext = "",
    maxIterations: number | null = AGENT_MAX_ITERATIONS
  ): Promise<string> {
    const startTime = Date.now();
    const startTokens = estimateTotalTokens(this.chatMessages);
    this.abortController = new AbortController();
    this.confirmBus.resetSkipConfirm();
    this.planBus.resetWaitTime();
    compactMessagesForContext(this.chatMessages);

    const durationTimer = setInterval(() => {
      const wait = this.confirmBus.getCurrentWaitTime() + this.planBus.getCurrentWaitTime();
      const elapsed = Date.now() - startTime - wait;
      if (elapsed >= 0) {
        this.messageBus.setLastAITotalDuration(elapsed);
      }
    }, AGENT_DURATION_UPDATE_INTERVAL_MS);

    let messageContent = query;
    if (fileContext) {
      messageContent = `${query}\n\n【用户引用的文件内容如下，请根据这些内容完成任务】${fileContext}`;
    }

    try {
      await checkAndSummarize(this);
      this.chatMessages.push(new HumanMessage(messageContent));
      this.beginAssistantTurn();

      let iterationCount = 0;
      while (maxIterations === null || iterationCount < maxIterations) {
        iterationCount++;
        if (this.abortController.signal.aborted) { this.messageBus.ai(AGENT_STATUS_TEXT.ABORTED); break; }

        const iterationStartTime = Date.now();
        this.messageBus.setThinkingStatus(ThinkingStatus.THINKING, AGENT_STATUS_TEXT.THINKING);

        let response: any;
        try {
          response = await this.invokeModelWithRetry();
        } catch (error) {
          if (this.abortController.signal.aborted) { this.messageBus.ai(AGENT_STATUS_TEXT.ABORTED); break; }
          this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
          handleApiError(this.config, error);
        }

        compactMessagesForContext(this.chatMessages);
        normalizeResponseToolCalls(response);
        if (this.mode === AgentMode.PLAN) {
          this.normalizePlanResponse(response);
        }
        this.chatMessages.push(normalizeResponse(response));

        if (this.mode === AgentMode.PLAN) {
          const planAction = await this.handlePlanModeResponse(response);
          if (planAction === "continue") {
            if (!response.tool_calls || response.tool_calls.length === 0) {
              this.messageBus.setThinkingStatus(ThinkingStatus.WAITING, AGENT_STATUS_TEXT.WAITING_AI);
              continue;
            }
          } else {
            break;
          }
        }

        if (!response.tool_calls || response.tool_calls.length === 0) break;

        await executeToolCalls(this, response, iterationStartTime);
        if (iterationCount > 1) await checkAndSummarize(this);
        if (this.abortController.signal.aborted) { this.messageBus.ai(AGENT_STATUS_TEXT.ABORTED); break; }
        this.messageBus.setThinkingStatus(ThinkingStatus.WAITING, AGENT_STATUS_TEXT.WAITING_AI);
      }

      this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
      if (!this.abortController?.signal.aborted) this.todoBus.completeAll();
      this.reportStats(startTime, startTokens);
      compactMessagesForContext(this.chatMessages);

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
      streamEnabled: this.streamEnabled,
      setStreamEnabled: (v) => { this.streamEnabled = v; },
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
    this.notifyModeChange();
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
    this.modeListeners.clear();
    this.mcpManager.close().catch(() => {});
  }
}
