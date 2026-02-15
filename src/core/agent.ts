import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  AIMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { createTools } from "./tools.ts";
import { MessageBus } from "./message-bus.ts";
import { ConfirmBus } from "./confirm-bus.ts";
import { ConfigManager } from "./config.ts";
import { ProcessManager } from "./process-manager.ts";
import { ThinkingStatus } from "./types.ts";
import type { ModelConfig } from "./types.ts";
import type { BaseMessage } from "@langchain/core/messages";
import { HELP_TEXT, type CommandAction } from "./commands.ts";
import { parseAtReferences, getFileContent } from "./file-scanner.ts";
import { join } from "path";
import {
  loadSystemPrompt,
  formatDuration,
  getToolNameFromChunk,
  getToolArgsPreview,
  getToolDescription,
  type ToolCall,
  type ToolArgs,
} from "./agent-helpers.ts";

/** 欢迎消息文本 */
const WELCOME_MESSAGE = `您好老板！

我是《牛码》；

我擅长写代码、改BUG等；

有什么可以为您效劳的？😊`;

/**
 * Agent 核心类 - 管理对话、工具调用和子系统
 */
export class Agent {
  /** 消息总线 */
  readonly messageBus = new MessageBus();
  /** 确认总线 */
  readonly confirmBus = new ConfirmBus();
  /** 配置管理器 */
  readonly config = new ConfigManager();
  /** 后台进程管理器 */
  private processManager = new ProcessManager();

  /** 对话消息历史 */
  private chatMessages: BaseMessage[];
  /** 当前绑定工具的模型实例 */
  private currentModel: ReturnType<ChatOpenAI["bindTools"]> | null = null;
  /** 系统提示词 */
  private systemPrompt: string;
  /** 工具列表 */
  private tools: ReturnType<typeof createTools>;
  /** 模型变更事件的取消订阅函数 */
  private unsubModelChange: (() => void);

  constructor() {
    this.systemPrompt = loadSystemPrompt();
    this.chatMessages = [new SystemMessage(this.systemPrompt)];
    this.tools = createTools(this.confirmBus, this.processManager);

    this.unsubModelChange = this.config.onModelChange(() => {
      this.currentModel = null;
    });

    this.messageBus.ai(WELCOME_MESSAGE);
  }

  /** 获取或创建绑定工具的模型实例 */
  private getModel() {
    if (!this.currentModel) {
      const modelConfig = this.config.getCurrentModel();
      this.currentModel = new ChatOpenAI({
        modelName: modelConfig.modelName,
        apiKey: modelConfig.apiKey,
        temperature: 0,
        timeout: 300000,
        maxRetries: 2,
        configuration: { baseURL: modelConfig.baseUrl },
      }).bindTools(this.tools);
    }
    return this.currentModel;
  }

  /** 清空对话历史，仅保留系统提示词 */
  clearMemory(): void {
    this.chatMessages.length = 0;
    this.chatMessages.push(new SystemMessage(this.systemPrompt));
  }

  /** 执行一次对话，支持多轮工具调用 */
  async run(query: string, fileContext: string = "", maxIterations = 30): Promise<string> {
    const startTime = Date.now();

    this.confirmBus.resetSkipConfirm();

    let messageContent = query;
    if (fileContext) {
      messageContent = `${query}\n\n【用户引用的文件内容如下，请根据这些内容完成任务】${fileContext}`;
    }

    this.chatMessages.push(new HumanMessage(messageContent));
    this.messageBus.createAIMessage();

    for (let i = 0; i < maxIterations; i++) {
      const iterationStartTime = Date.now();
      this.messageBus.setThinkingStatus(ThinkingStatus.THINKING, "玩命思考中...🐂🐎");

      let response: any;
      try {
        response = await this.streamResponse();
      } catch (error) {
        this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
        this.handleApiError(error);
      }

      this.chatMessages.push(this.normalizeResponse(response));

      if (!response.tool_calls || response.tool_calls.length === 0) {
        this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
        this.messageBus.ai(response.content || "");
        const totalDuration = Date.now() - startTime - this.confirmBus.totalWaitTime;
        this.messageBus.ai(`\n🕒 总耗时: ${formatDuration(totalDuration)}`);
        return response.content || "";
      }

      await this.executeToolCalls(response, iterationStartTime);
      this.messageBus.setThinkingStatus(ThinkingStatus.WAITING, "等待 AI 响应...");
    }

    this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
    const totalDuration = Date.now() - startTime - this.confirmBus.totalWaitTime;
    this.messageBus.ai(`\n🕒 总耗时: ${formatDuration(totalDuration)}`);

    const lastMessage = this.chatMessages[this.chatMessages.length - 1];
    return typeof lastMessage.content === "string" ? lastMessage.content : "";
  }

  /** 流式调用模型并实时更新思考状态 */
  private async streamResponse(): Promise<any> {
    const model = this.getModel();
    const stream = await model.stream(this.chatMessages);

    let response: any;
    let currentToolName: string | null = null;
    let currentToolArgs: string | null = null;

    for await (const chunk of stream) {
      response = response ? concat(response, chunk) : chunk;

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

    return response;
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
    for (const toolCall of response.tool_calls as ToolCall[]) {
      const contentText = response.content?.toString().replaceAll("\n", "") || "";
      if (contentText) {
        this.messageBus.ai(contentText);
      }

      const foundTool = this.tools.find((t) => t.name === toolCall.name);
      const toolDesc = getToolDescription(toolCall.name, toolCall.args as ToolArgs);

      this.messageBus.setThinkingStatus(ThinkingStatus.TOOL_CALLING, `执行中: ${toolDesc}`);

      if (foundTool) {
        try {
          const waitTimeBefore = this.confirmBus.totalWaitTime;
          const toolStartTime = Date.now();
          const toolResult = await (foundTool as any).invoke(toolCall.args);
          const waitTimeAdded = this.confirmBus.totalWaitTime - waitTimeBefore;
          const toolDuration = Date.now() - toolStartTime - waitTimeAdded;

          this.messageBus.tool(`${toolDesc} (耗时: ${formatDuration(toolDuration)})`);
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
      } else {
        this.messageBus.tool(`调用工具: ${toolCall.name}`);
        this.messageBus.error(`   ↳ 工具未找到`);
        this.chatMessages.push(
          new ToolMessage({ content: `工具 "${toolCall.name}" 未找到`, tool_call_id: toolCall.id })
        );
      }
    }
  }

  /** 执行斜杠命令，返回 UI 需要响应的动作 */
  executeCommand(command: string): CommandAction {
    switch (command) {
      case "model":
        return { action: "select_model" };
      case "clear":
        this.messageBus.clearMessages();
        this.clearMemory();
        this.confirmBus.resetSession();
        this.messageBus.createAIMessage();
        this.messageBus.ai("🧹 对话和记忆已清空");
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
      this.messageBus.setThinkingStatus(ThinkingStatus.IDLE);
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

  /** 清理后台进程 */
  cleanup(): void {
    this.processManager.cleanup();
  }

  /** 释放资源，取消事件监听 */
  dispose(): void {
    this.unsubModelChange();
  }
}
