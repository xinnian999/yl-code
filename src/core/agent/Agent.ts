import type { ChatOpenAI } from "@langchain/openai";
import { SystemMessage } from "@langchain/core/messages";
import type { BaseMessage } from "@langchain/core/messages";
import { createTools } from "../tooling/tool-factory.ts";
import type { ModeTool } from "../tooling/types.ts";
import { MessageBus } from "../message-bus.ts";
import { ConfirmBus } from "../confirm-bus.ts";
import { ConfigManager } from "../config/config-manager.ts";
import { ProcessManager } from "../execution/process-manager.ts";
import { TodoBus } from "../todo-bus.ts";
import { ContextBus } from "../context/context-bus.ts";
import { PlanBus } from "../plan/plan-bus.ts";
import { AgentMode, ThinkingStatus } from "../types.ts";
import type { ModelConfig, AgentModeValue } from "../types.ts";
import type { CommandAction } from "../commands.ts";
import {
  AGENT_DEFAULT_DEBUG_MODE,
  AGENT_DEFAULT_MODE,
  AGENT_DEFAULT_STREAM_ENABLED,
  AGENT_DURATION_UPDATE_INTERVAL_MS,
  AGENT_MAX_ITERATIONS,
  AGENT_STATUS_TEXT,
} from "../config/agent-config.ts";
import { SessionManager } from "../session/session-manager.ts";
import { McpConfigManager, McpManager } from "../mcp/index.ts";
import { loadSystemTemplate, buildSystemPrompt } from "./helpers.ts";
import { createBoundModel } from "./model.ts";
import { ExecutionStateManager } from "../execution/execution-state.ts";
import { SkillManager, buildSkillReferenceHint } from "../skills/index.ts";
import {
  buildFileContext,
  addModel as addModelFn,
  updateModel as updateModelFn,
  removeModel as removeModelFn,
  executeCommand as executeCommandFn,
  saveSession as saveSessionFn,
  restoreSession as restoreSessionFn,
  newSession as newSessionFn,
} from "./session.ts";
import { compactMessagesForContext } from "../context/compaction.ts";
import { buildAgentGraph } from "./graph/index.ts";
import type { AgentGraph, AgentGraphDeps } from "./graph/index.ts";

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
  /** 技能管理器 */
  readonly skillManager = new SkillManager();
  /** 后台进程管理器 */
  private processManager = new ProcessManager();
  /** 长任务执行状态管理器 */
  readonly executionState = new ExecutionStateManager();

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
  /** 技能变更事件的取消订阅函数 */
  private unsubSkillChange: () => void;
  /** 中断控制器 */
  private abortController: AbortController | null = null;
  /** 调试模式开关 */
  debugMode = AGENT_DEFAULT_DEBUG_MODE;
  /** 流式输出开关 */
  streamEnabled = AGENT_DEFAULT_STREAM_ENABLED;
  /** 模式变更监听器 */
  private modeListeners = new Set<(mode: AgentModeValue) => void>();
  /** 编译后的 Agent 图实例（首次使用时构建） */
  private graph: AgentGraph | null = null;
  /** Agent 图节点共享依赖（首次使用时构建） */
  private graphDeps: AgentGraphDeps | null = null;

  constructor() {
    this.systemTemplate = loadSystemTemplate();
    this.chatMessages = [new SystemMessage(this.buildCurrentSystemPrompt())];
    this.builtinTools = createTools(
      this.confirmBus,
      this.processManager,
      this.todoBus,
      this.skillManager,
    );
    this.tools = [...this.builtinTools];
    this.unsubModelChange = this.config.onModelChange(() => { this.currentModel = null; });
    this.unsubSkillChange = this.bindSkillChange();
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
    this.executionState.reset();
    this.chatMessages.length = 0;
    this.chatMessages.push(new SystemMessage(this.buildCurrentSystemPrompt()));
    this.contextBus.reset();
  }

  /** 构建当前系统提示词 */
  private buildCurrentSystemPrompt(): string {
    return buildSystemPrompt(
      this.systemTemplate,
      this.mode,
      this.executionState.buildPromptText(),
      process.cwd(),
      this.skillManager.getSkills(),
    );
  }

  /** 绑定技能变更事件 */
  private bindSkillChange(): () => void {
    const handleChange = () => {
      this.refreshSystemPrompt();
    };

    this.skillManager.on("skills:change", handleChange);
    return () => {
      this.skillManager.off("skills:change", handleChange);
    };
  }

  /** 刷新系统提示词，使动态执行状态进入下一轮模型请求 */
  private refreshSystemPrompt(): void {
    const systemPrompt = this.buildCurrentSystemPrompt();
    if (this.chatMessages.length === 0) {
      this.chatMessages.push(new SystemMessage(systemPrompt));
      return;
    }
    this.chatMessages[0] = new SystemMessage(systemPrompt);
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

  /** 输出本轮耗时统计 */
  private reportStats(startTime: number): void {
    const totalDuration = Date.now()
      - startTime
      - this.confirmBus.totalWaitTime
      - this.planBus.totalWaitTime;
    this.messageBus.setLastAITotalDuration(totalDuration);
  }

  /** 创建新的 AI 消息并绑定当前任务列表 */
  private beginAssistantTurn(): void {
    const aiMessage = this.messageBus.createAIMessage();
    this.todoBus.setCurrentMessageId(aiMessage.id);
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

  /** 构建或复用 graph 节点依赖端口 */
  private buildGraphDeps(): AgentGraphDeps {
    if (this.graphDeps) return this.graphDeps;
    this.graphDeps = {
      messageBus: this.messageBus,
      confirmBus: this.confirmBus,
      planBus: this.planBus,
      todoBus: this.todoBus,
      contextBus: this.contextBus,
      config: this.config,
      executionState: this.executionState,
      getTools: () => this.tools,
      isDebugMode: () => this.debugMode,
      isStreamEnabled: () => this.streamEnabled,
      getModel: () => this.getModel(),
      getAbortController: () => this.abortController,
      getMode: () => this.mode,
      setMode: (mode) => this.setMode(mode),
      refreshSystemPrompt: () => this.refreshSystemPrompt(),
      beginAssistantTurn: () => this.beginAssistantTurn(),
    };
    return this.graphDeps;
  }

  /** 获取或构建编译后的 Agent 图实例 */
  private getGraph(): AgentGraph {
    if (!this.graph) {
      this.graph = buildAgentGraph(this.buildGraphDeps());
    }
    return this.graph;
  }

  /** 启动本轮耗时刷新计时器 */
  private startDurationTimer(startTime: number): NodeJS.Timeout {
    return setInterval(() => {
      const wait =
        this.confirmBus.getCurrentWaitTime() + this.planBus.getCurrentWaitTime();
      const elapsed = Date.now() - startTime - wait;
      if (elapsed >= 0) {
        this.messageBus.setLastAITotalDuration(elapsed);
      }
    }, AGENT_DURATION_UPDATE_INTERVAL_MS);
  }

  /** 主对话流程结束后的收尾：状态清理、收尾压缩、统计 */
  private finalizeRun(startTime: number): string {
    this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
    if (!this.abortController?.signal.aborted) {
      this.todoBus.completeAll();
    }
    this.reportStats(startTime);
    compactMessagesForContext(this.chatMessages);

    const lastMessage = this.chatMessages[this.chatMessages.length - 1];
    return typeof lastMessage?.content === "string" ? lastMessage.content : "";
  }

  /** 执行一次对话，支持多轮工具调用（驱动 LangGraph 主循环图） */
  async run(
    query: string,
    fileContext = "",
    maxIterations: number | null = AGENT_MAX_ITERATIONS
  ): Promise<string> {
    const startTime = Date.now();
    this.abortController = new AbortController();
    const durationTimer = this.startDurationTimer(startTime);

    try {
      const finalState = await this.getGraph().invoke(
        {
          messages: this.chatMessages,
          mode: this.mode,
          userQuery: query,
          fileContext,
        },
        {
          signal: this.abortController.signal,
          recursionLimit: maxIterations ?? 250,
        }
      );
      this.chatMessages = finalState.messages;
      return this.finalizeRun(startTime);
    } finally {
      clearInterval(durationTimer);
    }
  }

  /** 完整对话入口：解析文件引用 → 发送消息 → 调用 AI → 处理错误 */
  async chat(query: string): Promise<void> {
    this.messageBus.user(query);
    try {
      const skillHint = buildSkillReferenceHint(
        query,
        this.skillManager.getEnabledSkillNames(),
      );
      const nextQuery = skillHint
        ? `${query}\n\n${skillHint.message}`
        : query;

      await this.run(nextQuery, buildFileContext(query));
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

  /** 获取当前模型名称（用户自定义名称） */
  getCurrentModelName(): string { return this.config.getCurrentModel().name; }

  /** 发送系统通知消息 */
  notify(message: string): void { this.messageBus.createAIMessage(); this.messageBus.ai(message); }

  /** 获取当前工作模式 */
  getMode(): AgentModeValue { return this.mode; }

  /** 获取技能索引列表 */
  getSkills() { return this.skillManager.getSkills(); }

  /** 获取技能索引摘要 */
  getSkillIndexSummary(): string { return this.skillManager.getSkillIndexSummary(); }

  /** 切换技能启用状态 */
  toggleSkill(skillName: string): boolean { return this.skillManager.toggleSkill(skillName); }

  /** 重新扫描技能目录 */
  reloadSkills(): void { this.skillManager.reload(); }

  /** 设置工作模式 */
  setMode(mode: AgentModeValue): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.currentModel = null;
    this.refreshSystemPrompt();
    this.notifyModeChange();
  }

  /** 保存当前会话 */
  saveSession(): void { saveSessionFn(this); }

  /** 恢复指定会话 */
  restoreSession(sessionId: string): boolean {
    const restored = restoreSessionFn(this, sessionId);
    if (!restored) return false;
    this.executionState.reset();
    this.refreshSystemPrompt();
    return true;
  }

  /** 开始新对话会话 */
  newSession(): void { newSessionFn(this); }

  /** 清理后台进程 */
  cleanup(): void { this.processManager.cleanup(); }

  /** 释放资源 */
  dispose(): void {
    this.saveSession();
    this.unsubModelChange();
    this.unsubSkillChange();
    this.modeListeners.clear();
    this.mcpManager.close().catch(() => {});
  }
}
