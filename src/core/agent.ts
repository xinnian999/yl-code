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
import type { BaseMessage } from "@langchain/core/messages";
import {
  loadSystemPrompt,
  formatDuration,
  getToolNameFromChunk,
  getToolArgsPreview,
  getToolDescription,
  type ToolCall,
  type ToolArgs,
} from "./agent-helpers.ts";

const WELCOME_MESSAGE = `您好老板！

我是《牛码》；

我擅长写代码、改BUG等；

有什么可以为您效劳的？😊`;

export class Agent {
  readonly messageBus = new MessageBus();
  readonly confirmBus = new ConfirmBus();
  readonly config = new ConfigManager();
  private processManager = new ProcessManager();

  private chatMessages: BaseMessage[];
  private currentModel: ReturnType<ChatOpenAI["bindTools"]> | null = null;
  private systemPrompt: string;
  private tools: ReturnType<typeof createTools>;
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

  clearMemory(): void {
    this.chatMessages.length = 0;
    this.chatMessages.push(new SystemMessage(this.systemPrompt));
  }

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

  cleanup(): void {
    this.processManager.cleanup();
  }

  dispose(): void {
    this.unsubModelChange();
  }
}
