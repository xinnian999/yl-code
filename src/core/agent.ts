import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  AIMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { createTools, getToolsForMode } from "./tools.ts";
import type { ModeTool } from "./tools.ts";
import { MessageBus } from "./message-bus.ts";
import { ConfirmBus } from "./confirm-bus.ts";
import { ConfigManager } from "./config.ts";
import { ProcessManager } from "./process-manager.ts";
import { TodoBus } from "./todo-bus.ts";
import { AgentMode, ThinkingStatus } from "./types.ts";
import type { ModelConfig, AgentModeValue } from "./types.ts";
import type { BaseMessage } from "@langchain/core/messages";
import { HELP_TEXT, type CommandAction } from "./commands.ts";
import { SessionManager } from "./session-manager.ts";
import { parseAtReferences, getFileContent } from "./file-scanner.ts";
import { join } from "path";
import {
  loadSystemTemplate,
  buildSystemPrompt,
  formatDuration,
  getToolNameFromChunk,
  getToolArgsPreview,
  getToolDescription,
  type ToolCall,
  type ToolArgs,
} from "./agent-helpers.ts";

/** 欢迎消息文本 */
const WELCOME_MESSAGE = `您好老板！

我是一个会写代码的《牛码》；

有什么可以为您效劳的？😊`;

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
  /** 配置管理器 */
  readonly config = new ConfigManager();
  /** 会话管理器 */
  readonly sessionManager = new SessionManager();
  /** 后台进程管理器 */
  private processManager = new ProcessManager();

  /** 对话消息历史 */
  private chatMessages: BaseMessage[];
  /** 当前绑定工具的模型实例 */
  private currentModel: ReturnType<ChatOpenAI["bindTools"]> | null = null;
  /** 系统提示词原始模板 */
  private systemTemplate: string;
  /** 带模式标签的工具列表 */
  private tools: ModeTool[];
  /** 当前工作模式 */
  private mode: AgentModeValue = AgentMode.BUILD;
  /** 模型变更事件的取消订阅函数 */
  private unsubModelChange: (() => void);
  /** 中断控制器，用于取消正在进行的 AI 请求 */
  private abortController: AbortController | null = null;
  /** 调试模式开关，开启后实时输出流式 chunk 详情 */
  private debugMode = false;

  constructor() {
    this.systemTemplate = loadSystemTemplate();
    const systemPrompt = buildSystemPrompt(this.systemTemplate, this.mode);
    this.chatMessages = [new SystemMessage(systemPrompt)];
    this.tools = createTools(this.confirmBus, this.processManager, this.todoBus);

    this.unsubModelChange = this.config.onModelChange(() => {
      this.currentModel = null;
    });

    this.messageBus.ai(WELCOME_MESSAGE);
  }

  /** 获取或创建绑定工具的模型实例（根据当前模式筛选工具） */
  private getModel() {
    if (!this.currentModel) {
      const modelConfig = this.config.getCurrentModel();
      const llm = new ChatOpenAI({
        modelName: modelConfig.modelName,
        apiKey: modelConfig.apiKey,
        temperature: 0,
        timeout: 300000,
        maxRetries: 2,
        configuration: { baseURL: modelConfig.baseUrl },
      });
      const tools = getToolsForMode(this.tools, this.mode);
      this.currentModel = llm.bindTools(tools);

      if (this.debugMode) {
        this.messageBus.debug(`模型: ${modelConfig.modelName}`);
        this.messageBus.debug(`baseURL: ${modelConfig.baseUrl}`);
        this.messageBus.debug(`绑定工具数: ${tools.length} | 名称: ${tools.map((t) => t.name).join(", ")}`);
      }
    }
    return this.currentModel;
  }

  /** 获取调试模式状态 */
  isDebugMode(): boolean {
    return this.debugMode;
  }

  /** 中断当前正在进行的 AI 请求 */
  abort(): void {
    this.abortController?.abort();
  }

  /** 清空对话历史，仅保留系统提示词 */
  clearMemory(): void {
    this.chatMessages.length = 0;
    const systemPrompt = buildSystemPrompt(this.systemTemplate, this.mode);
    this.chatMessages.push(new SystemMessage(systemPrompt));
  }

  /** 执行一次对话，支持多轮工具调用 */
  async run(query: string, fileContext: string = "", maxIterations = 30): Promise<string> {
    const startTime = Date.now();

    this.abortController = new AbortController();
    this.confirmBus.resetSkipConfirm();

    let messageContent = query;
    if (fileContext) {
      messageContent = `${query}\n\n【用户引用的文件内容如下，请根据这些内容完成任务】${fileContext}`;
    }

    this.chatMessages.push(new HumanMessage(messageContent));
    const aiMessage = this.messageBus.createAIMessage();
    this.todoBus.setCurrentMessageId(aiMessage.id);

    for (let i = 0; i < maxIterations; i++) {
      // 检查是否已中断
      if (this.abortController.signal.aborted) {
        this.messageBus.ai("\n⚠️ 已中断");
        break;
      }

      const iterationStartTime = Date.now();
      this.messageBus.setThinkingStatus(ThinkingStatus.THINKING, "玩命思考中...🐂🐎");

      let response: any;
      try {
        response = await this.streamResponse(this.abortController.signal);
      } catch (error) {
        // 中断引起的错误，正常退出
        if (this.abortController.signal.aborted) {
          this.messageBus.ai("\n⚠️ 已中断");
          break;
        }
        this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
        this.handleApiError(error);
      }

      this.chatMessages.push(this.normalizeResponse(response));

      if (!response.tool_calls || response.tool_calls.length === 0) {
        this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
        this.todoBus.completeAll();
        const totalDuration = Date.now() - startTime - this.confirmBus.totalWaitTime;
        this.messageBus.ai(`\n🕒 总耗时: ${formatDuration(totalDuration)}`);
        return response.content || "";
      }

      await this.executeToolCalls(response, iterationStartTime);

      // 工具调用后再次检查中断
      if (this.abortController.signal.aborted) {
        this.messageBus.ai("\n⚠️ 已中断");
        break;
      }

      this.messageBus.setThinkingStatus(ThinkingStatus.WAITING, "等待 AI 响应...");
    }

    this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
    if (!this.abortController?.signal.aborted) {
      this.todoBus.completeAll();
    }
    const totalDuration = Date.now() - startTime - this.confirmBus.totalWaitTime;
    this.messageBus.ai(`\n🕒 总耗时: ${formatDuration(totalDuration)}`);

    const lastMessage = this.chatMessages[this.chatMessages.length - 1];
    return typeof lastMessage.content === "string" ? lastMessage.content : "";
  }

  /** 流式调用模型并实时输出文本到 UI */
  private async streamResponse(signal: AbortSignal): Promise<any> {
    const model = this.getModel();
    const stream = await model.stream(this.chatMessages, { signal });

    let response: any;
    let currentToolName: string | null = null;
    let currentToolArgs: string | null = null;
    let chunkIndex = 0;
    let streamBlockIndex = -1;

    for await (const chunk of stream) {
      response = response ? concat(response, chunk) : chunk;

      // 流式输出文本内容到 UI
      if (chunk.content) {
        const text = typeof chunk.content === "string" ? chunk.content : String(chunk.content);
        if (text) {
          if (streamBlockIndex === -1) {
            this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
            streamBlockIndex = this.messageBus.createTextBlock(text);
          } else {
            this.messageBus.appendToBlock(streamBlockIndex, text);
          }
        }
      }

      if (this.debugMode) {
        this.logChunkDebug(chunk, chunkIndex);
        chunkIndex++;
      }

      const chunkAny = chunk as any;
      if (chunkAny.tool_call_chunks?.length > 0) {
        const toolName = getToolNameFromChunk(chunkAny.tool_call_chunks);
        const toolArgs = getToolArgsPreview(chunkAny.tool_call_chunks);

        if (toolName && toolName !== currentToolName) {
          currentToolName = toolName;
          this.messageBus.setThinkingStatus(ThinkingStatus.TOOL_CALLING, `准备调用: ${toolName}`);
        }

        if (toolArgs && toolArgs !== currentToolArgs) {
          currentToolArgs = toolArgs;
          const toolDesc = getToolDescription(currentToolName!, {
            filePath: toolArgs,
            directoryPath: toolArgs,
            command: toolArgs,
          });
          this.messageBus.setThinkingStatus(ThinkingStatus.TOOL_CALLING, toolDesc);
        }
      }
    }

    if (this.debugMode) {
      this.messageBus.debug(`流式完成，共 ${chunkIndex} 个 chunk`);
      this.logResponseDebug(response);
    }

    return response;
  }

  /** 输出单个 chunk 的调试信息 */
  private logChunkDebug(chunk: any, index: number): void {
    const parts: string[] = [`#${index}`];

    if (chunk.content) {
      const text = typeof chunk.content === "string" ? chunk.content : JSON.stringify(chunk.content);
      parts.push(`text: "${text}"`);
    }

    if (chunk.tool_call_chunks?.length > 0) {
      for (const tc of chunk.tool_call_chunks) {
        if (tc.name) parts.push(`tool: ${tc.name}`);
        if (tc.args) parts.push(`args: ${tc.args}`);
      }
    }

    // 只在有实质内容时输出，跳过空 chunk
    if (parts.length > 1) {
      this.messageBus.debug(parts.join(" | "));
    }
  }

  /** 输出完整响应的调试信息，用于排查工具调用问题 */
  private logResponseDebug(response: any): void {
    const toolCalls = response.tool_calls;
    const kwargs = response.additional_kwargs;

    this.messageBus.debug(`tool_calls: ${toolCalls ? JSON.stringify(toolCalls).slice(0, 300) : "无"}`);

    if (kwargs) {
      const kwargKeys = Object.keys(kwargs);
      this.messageBus.debug(`additional_kwargs keys: [${kwargKeys.join(", ")}]`);
      if (kwargs.tool_calls) {
        this.messageBus.debug(`kwargs.tool_calls: ${JSON.stringify(kwargs.tool_calls).slice(0, 300)}`);
      }
    }

    if (response.response_metadata) {
      const meta = response.response_metadata;
      const finishReason = meta.finish_reason || meta.stop_reason || "未知";
      this.messageBus.debug(`finish_reason: ${finishReason}`);
    }

    const contentType = typeof response.content;
    const contentLen = contentType === "string" ? response.content.length : JSON.stringify(response.content).length;
    this.messageBus.debug(`content 类型: ${contentType} | 长度: ${contentLen}`);
  }

  /** 标准化响应，确保空内容时有占位文本 */
  private normalizeResponse(response: any): BaseMessage {
    const hasEmptyContent =
      !response.content ||
      (typeof response.content === "string" && response.content.trim() === "");

    if (hasEmptyContent && response.tool_calls?.length > 0) {
      return new AIMessage({
        content: "正在执行工具...",
        tool_calls: response.tool_calls,
        additional_kwargs: response.additional_kwargs,
        response_metadata: response.response_metadata,
      });
    }
    return response;
  }

  /** 处理 API 调用错误，附加配置诊断信息 */
  private handleApiError(error: unknown): never {
    const err = error as any;
    const errorMessage = err?.message || err?.error?.message || String(error);
    const errorDetails = err?.error || err?.response?.data || err;

    const modelConfig = this.config.getCurrentModel();
    if (!modelConfig.apiKey) {
      throw new Error("未配置模型 API Key，请检查 ~/.niu-code/config.json");
    }
    if (!modelConfig.baseUrl) {
      throw new Error("未配置模型 Base URL，请检查 ~/.niu-code/config.json");
    }
    if (!modelConfig.modelName) {
      throw new Error("未配置模型名称，请检查 ~/.niu-code/config.json");
    }

    const detailedError = new Error(
      `API 调用失败: ${errorMessage}${errorDetails ? `\n详细信息: ${JSON.stringify(errorDetails, null, 2)}` : ""}`
    );
    (detailedError as any).cause = error;
    throw detailedError;
  }

  /** 执行响应中的工具调用列表 */
  private async executeToolCalls(response: any, iterationStartTime: number): Promise<void> {
    const allowedTools = getToolsForMode(this.tools, this.mode);

    for (const toolCall of response.tool_calls as ToolCall[]) {
      const foundTool = allowedTools.find((t) => t.name === toolCall.name);
      const toolDesc = getToolDescription(toolCall.name, toolCall.args as ToolArgs);

      if (this.debugMode) {
        this.messageBus.debug(`工具调用: ${toolCall.name} | id: ${toolCall.id}`);
        this.messageBus.debug(`参数: ${JSON.stringify(toolCall.args)}`);
      }

      this.messageBus.setThinkingStatus(ThinkingStatus.TOOL_CALLING, `执行中: ${toolDesc}`);

      if (!foundTool) {
        const isKnownTool = this.tools.some((t) => t.tool.name === toolCall.name);
        const errorMsg = isKnownTool
          ? `工具 "${toolCall.name}" 在当前模式下不可用，请切换到 Build 模式`
          : `工具 "${toolCall.name}" 未找到`;

        this.messageBus.tool(`调用工具: ${toolCall.name}`);
        this.messageBus.error(`   ↳ ${errorMsg}`);
        this.chatMessages.push(
          new ToolMessage({ content: errorMsg, tool_call_id: toolCall.id })
        );
        continue;
      }

      try {
        const waitTimeBefore = this.confirmBus.totalWaitTime;
        const toolStartTime = Date.now();
        const toolResult = await (foundTool as any).invoke(toolCall.args);
        const waitTimeAdded = this.confirmBus.totalWaitTime - waitTimeBefore;
        const toolDuration = Date.now() - toolStartTime - waitTimeAdded;

        this.messageBus.tool(`${toolDesc} (耗时: ${formatDuration(toolDuration)})`);

        if (this.debugMode) {
          const resultStr = String(toolResult);
          const preview = resultStr.length > 500 ? resultStr.slice(0, 500) + "...(截断)" : resultStr;
          this.messageBus.debug(`返回结果 (${resultStr.length}字符): ${preview}`);
        }

        this.chatMessages.push(
          new ToolMessage({ content: toolResult as string, tool_call_id: toolCall.id })
        );
      } catch (error) {
        const toolDuration = Date.now() - iterationStartTime;
        const err = error as Error;
        const errMsg = err?.message || String(error);
        this.messageBus.tool(`${toolDesc} (耗时: ${formatDuration(toolDuration)})`);
        this.messageBus.error(`   ↳ 失败: ${errMsg}`);
        this.chatMessages.push(
          new ToolMessage({ content: `工具执行失败: ${errMsg}`, tool_call_id: toolCall.id })
        );
      }
    }
  }

  /** 执行斜杠命令，返回 UI 需要响应的动作 */
  executeCommand(command: string): CommandAction {
    switch (command) {
      case "new":
        this.newSession();
        return { action: "none" };
      case "history":
        return { action: "show_history" };
      case "model":
        return { action: "select_model" };
      case "clear":
        this.newSession();
        return { action: "none" };
      case "debug":
        this.debugMode = !this.debugMode;
        this.messageBus.createAIMessage();
        this.messageBus.ai(this.debugMode ? "🐛 调试模式已开启" : "🐛 调试模式已关闭");
        return { action: "none" };
      case "help":
        this.messageBus.createAIMessage();
        this.messageBus.ai(HELP_TEXT);
        return { action: "none" };
      case "exit":
        this.messageBus.ai("👋 再见！");
        return { action: "exit" };
      default:
        return { action: "none" };
    }
  }

  /** 切换当前模型并发送提示消息 */
  switchModel(model: ModelConfig): void {
    this.config.setCurrentModel(model.id);
    this.messageBus.createAIMessage();
    this.messageBus.ai(`✅ 已切换到: ${model.name}`);
  }

  /** 完整对话入口：解析文件引用 → 发送消息 → 调用 AI → 处理错误 */
  async chat(query: string): Promise<void> {
    const fileContext = this.buildFileContext(query);
    this.messageBus.user(query);

    try {
      await this.run(query, fileContext);
    } catch (error) {
      this.messageBus.createAIMessage();
      const err = error as Error;
      this.messageBus.error(err?.message || String(error));
    } finally {
      this.abortController = null;
      this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
      this.saveSession();
    }
  }

  /** 从用户输入中解析 @ 引用并构建文件上下文 */
  private buildFileContext(query: string): string {
    const atRefs = parseAtReferences(query);
    if (atRefs.length === 0) return "";

    const contents = atRefs.map((ref) => {
      const fullPath = join(process.cwd(), ref);
      return `--- 文件: ${ref} ---\n${getFileContent(fullPath)}\n--- 文件结束 ---`;
    });
    return "\n\n" + contents.join("\n\n");
  }

  /** 添加模型配置并自动切换 */
  addModel(data: { name: string; baseUrl: string; apiKey: string; modelName: string }): void {
    const newModel: ModelConfig = {
      id: `model_${Date.now()}`,
      name: data.name,
      baseUrl: data.baseUrl,
      apiKey: data.apiKey,
      modelName: data.modelName,
    };
    this.config.addModel(newModel);
    this.config.setCurrentModel(newModel.id);
    this.notify(`✅ 模型 "${data.name}" 添加成功，已自动切换`);
  }

  /** 更新模型配置 */
  updateModel(modelId: string, data: { name: string; baseUrl: string; apiKey: string; modelName: string }): void {
    this.config.updateModel(modelId, data);
    this.notify(`✅ 模型 "${data.name}" 更新成功`);
  }

  /** 删除模型配置（不能删除当前使用的模型） */
  removeModel(modelId: string): boolean {
    if (modelId === this.config.getCurrentModelId()) {
      this.notify("⚠️ 不能删除当前正在使用的模型，请先切换到其他模型");
      return false;
    }
    const model = this.config.getModels().find((m) => m.id === modelId);
    this.config.removeModel(modelId);
    this.notify(`✅ 模型 "${model?.name}" 已删除`);
    return true;
  }

  /** 获取所有模型配置 */
  getModels(): ModelConfig[] {
    return this.config.getModels();
  }

  /** 获取当前模型 ID */
  getCurrentModelId(): string {
    return this.config.getCurrentModelId();
  }

  /** 发送系统通知消息 */
  notify(message: string): void {
    this.messageBus.createAIMessage();
    this.messageBus.ai(message);
  }

  // ============ 模式管理 ============

  /** 获取当前工作模式 */
  getMode(): AgentModeValue {
    return this.mode;
  }

  /** 设置工作模式，更新系统提示词并清除模型缓存以重新绑定工具 */
  setMode(mode: AgentModeValue): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.currentModel = null;
    this.updateSystemMessage();
  }

  /** 更新对话历史中的系统提示词（替换 chatMessages[0]） */
  private updateSystemMessage(): void {
    const systemPrompt = buildSystemPrompt(this.systemTemplate, this.mode);
    if (this.chatMessages.length > 0) {
      this.chatMessages[0] = new SystemMessage(systemPrompt);
    }
  }

  // ============ 会话管理 ============

  /** 获取第一条用户消息内容（用于会话标题） */
  private getFirstUserMessage(): string {
    for (const msg of this.chatMessages) {
      if (msg instanceof HumanMessage) {
        return typeof msg.content === "string" ? msg.content : "";
      }
    }
    return "";
  }

  /** 保存当前会话到磁盘 */
  saveSession(): void {
    this.sessionManager.saveCurrentSession(
      this.chatMessages,
      this.messageBus.getMessages(),
      this.getFirstUserMessage()
    );
  }

  /** 恢复指定会话（保存当前 → 加载目标 → 恢复状态） */
  restoreSession(sessionId: string): boolean {
    this.saveSession();
    const data = this.sessionManager.switchToSession(sessionId);
    if (!data) return false;

    this.chatMessages = data.chatMessages;
    this.updateSystemMessage();
    this.messageBus.restoreMessages(data.uiMessages);
    this.confirmBus.resetSession();
    return true;
  }

  /** 开始新对话会话（保存当前 → 新建空白） */
  newSession(): void {
    this.saveSession();
    this.sessionManager.startNewSession();
    this.clearMemory();
    this.messageBus.clearMessages();
    this.confirmBus.resetSession();
    this.todoBus.clearTodos();
    this.messageBus.createAIMessage();
    this.messageBus.ai("🧹 已开启新对话");
  }

  /** 清理后台进程 */
  cleanup(): void {
    this.processManager.cleanup();
  }

  /** 释放资源，取消事件监听 */
  dispose(): void {
    this.saveSession();
    this.unsubModelChange();
  }
}
