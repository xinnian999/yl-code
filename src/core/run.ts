import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  AIMessage,
} from "@langchain/core/messages";
import { concat } from "@langchain/core/utils/stream";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import tools from "./tools.ts";
import messageBus, { ThinkingStatus } from "@/utils/message-bus.ts";
import type { BaseMessage } from "@langchain/core/messages";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取系统提示词模板
const systemPromptTemplate = readFileSync(
  join(__dirname, "system.md"),
  "utf-8"
);

// 替换模板变量
const systemPrompt = systemPromptTemplate.replace(
  "${process.cwd()}",
  process.cwd()
);

const timeout = 300000;

const model = new ChatOpenAI({
  modelName: process.env.NIUMA_MODEL_NAME,
  apiKey: process.env.NIUMA_API_KEY,
  temperature: 0,
  timeout,
  maxRetries: 2,   // 最多重试 2 次
  configuration: {
    baseURL: process.env.NIUMA_BASE_URL,
  },
}).bindTools(tools);

const messages: BaseMessage[] = [new SystemMessage(systemPrompt)];

interface ToolCallChunk {
  name?: string;
  args?: string;
}

interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

interface ToolArgs {
  filePath?: string;
  directoryPath?: string;
  command?: string;
}

/**
 * 从流式工具调用块中提取工具名称
 */
const getToolNameFromChunk = (toolCallChunks: ToolCallChunk[]): string | null => {
  if (!toolCallChunks || toolCallChunks.length === 0) return null;
  const chunk = toolCallChunks[0];
  return chunk.name || null;
};

/**
 * 从流式工具调用块中提取文件路径参数（用于显示）
 */
const getToolArgsPreview = (toolCallChunks: ToolCallChunk[]): string | null => {
  if (!toolCallChunks || toolCallChunks.length === 0) return null;
  const chunk = toolCallChunks[0];
  if (!chunk.args) return null;
  
  try {
    // 尝试解析部分 JSON 来获取文件路径
    const argsStr = chunk.args;
    // 匹配 filePath 或 directoryPath 或 command
    const filePathMatch = argsStr.match(/"filePath"\s*:\s*"([^"]+)"/);
    if (filePathMatch) return filePathMatch[1];
    
    const dirPathMatch = argsStr.match(/"directoryPath"\s*:\s*"([^"]+)"/);
    if (dirPathMatch) return dirPathMatch[1];
    
    const commandMatch = argsStr.match(/"command"\s*:\s*"([^"]+)"/);
    if (commandMatch) return commandMatch[1];
  } catch (e) {
    // 忽略解析错误
  }
  return null;
};

/**
 * 格式化耗时
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

/**
 * 获取工具调用的描述信息
 */
const getToolDescription = (toolName: string, args: ToolArgs): string => {
  switch (toolName) {
    case "read_file":
      return `阅读代码: ${args.filePath}`;
    case "write_file":
      return `写入代码: ${args.filePath}`;
    case "execute_command":
      return `执行命令: ${args.command}`;
    case "list_directory":
      return `查看目录: ${args.directoryPath}`;
    default:
      return `调用工具: ${toolName}`;
  }
};

// Agent 执行函数（流式版本）
async function run(query: string, maxIterations: number = 30): Promise<string> {
  const startTime = Date.now(); // 记录总开始时间

  messages.push(new HumanMessage(query));

  // 创建一个 AI 消息来承载所有输出（工具调用、最终响应等）
  messageBus.createAIMessage();

  for (let i = 0; i < maxIterations; i++) {
    // 记录本轮迭代开始时间（包含思考+工具执行）
    const iterationStartTime = Date.now();

    // 设置思考状态
    messageBus.setThinkingStatus(ThinkingStatus.THINKING, "玩命思考中...🐂🐎");

    let response: any;
    try {
      // 使用流式输出
      const stream = await model.stream(messages);
      
      let currentToolName: string | null = null;
      let currentToolArgs: string | null = null;
      
      // 处理流式输出
      for await (const chunk of stream) {
        // 累积响应
        response = response ? concat(response, chunk) : chunk;
        
        // 检测工具调用并实时更新状态
        const chunkAny = chunk as any;
        if (chunkAny.tool_call_chunks && chunkAny.tool_call_chunks.length > 0) {
          const toolName = getToolNameFromChunk(chunkAny.tool_call_chunks);
          const toolArgs = getToolArgsPreview(chunkAny.tool_call_chunks);
          
          // 工具名称首次出现时切换状态
          if (toolName && toolName !== currentToolName) {
            currentToolName = toolName;
            messageBus.setThinkingStatus(
              ThinkingStatus.TOOL_CALLING,
              `准备调用: ${toolName}`
            );
          }
          
          // 参数出现时更新状态显示
          if (toolArgs && toolArgs !== currentToolArgs) {
            currentToolArgs = toolArgs;
            const toolDesc = getToolDescription(currentToolName!, { 
              filePath: toolArgs, 
              directoryPath: toolArgs, 
              command: toolArgs 
            });
            messageBus.setThinkingStatus(
              ThinkingStatus.TOOL_CALLING,
              toolDesc
            );
          }
        }
      }
    } catch (error) {
      // 清除思考状态
      messageBus.setThinkingStatus(ThinkingStatus.IDLE);

      const err = error as any;
      // 处理 API 调用错误
      const errorMessage = err?.message || err?.error?.message || String(error);
      const errorDetails = err?.error || err?.response?.data || err;

      // 检查是否是配置问题
      if (!process.env.NIUMA_API_KEY) {
        throw new Error("未配置 NIUMA_API_KEY 环境变量");
      }
      if (!process.env.NIUMA_BASE_URL) {
        throw new Error("未配置 NIUMA_BASE_URL 环境变量");
      }
      if (!process.env.NIUMA_MODEL_NAME) {
        throw new Error("未配置 NIUMA_MODEL_NAME 环境变量");
      }

      // 抛出更详细的错误信息
      const detailedError = new Error(
        `API 调用失败: ${errorMessage}${errorDetails ? `\n详细信息: ${JSON.stringify(errorDetails, null, 2)}` : ""}`
      );
      (detailedError as any).cause = error;
      throw detailedError;
    }

    // 如果 content 为空且有工具调用，创建一个新的 AIMessage 确保 content 不为空
    let messageToAdd = response;
    if (
      (!response.content || (typeof response.content === 'string' && response.content.trim() === "")) &&
      response.tool_calls &&
      response.tool_calls.length > 0
    ) {
      messageToAdd = new AIMessage({
        content: "正在执行工具...",
        tool_calls: response.tool_calls,
        additional_kwargs: response.additional_kwargs,
        response_metadata: response.response_metadata,
      });
    }

    messages.push(messageToAdd);

    // 如果没有工具调用，直接返回内容
    if (!response.tool_calls || response.tool_calls.length === 0) {
      messageBus.setThinkingStatus(ThinkingStatus.IDLE);
      messageBus.ai(response.content || "");
      // 输出总耗时
      const totalDuration = Date.now() - startTime;
      messageBus.ai(`\n🕒 总耗时: ${formatDuration(totalDuration)}`);
      return response.content || "";
    }

    // 执行工具调用
    for (const toolCall of response.tool_calls as ToolCall[]) {
      const contentText = response.content?.toString().replaceAll('\n', '') || "";
      if (contentText) {
        messageBus.ai(contentText);
      }

      const foundTool = tools.find((t) => t.name === toolCall.name);
      const toolDesc = getToolDescription(toolCall.name, toolCall.args as ToolArgs);

      // 更新思考状态：正在执行工具
      messageBus.setThinkingStatus(
        ThinkingStatus.TOOL_CALLING,
        `执行中: ${toolDesc}`
      );

      if (foundTool) {
        try {
          const toolResult = await (foundTool as any).invoke(toolCall.args);
          const toolDuration = Date.now() - iterationStartTime; // 从本轮开始计算耗时

          // 输出工具调用信息和耗时
          messageBus.tool(`${toolDesc} (耗时: ${formatDuration(toolDuration)})`);

          messages.push(
            new ToolMessage({
              content: toolResult as string,
              tool_call_id: toolCall.id,
            })
          );
        } catch (error) {
          const toolDuration = Date.now() - iterationStartTime;
          // 工具执行失败，将错误信息作为 ToolMessage 返回
          const err = error as Error;
          const errorMessage = err?.message || String(error);
          messageBus.tool(`${toolDesc} (耗时: ${formatDuration(toolDuration)})`);
          messageBus.error(`   ↳ 失败: ${errorMessage}`);
          messages.push(
            new ToolMessage({
              content: `工具执行失败: ${errorMessage}`,
              tool_call_id: toolCall.id,
            })
          );
        }
      } else {
        // 工具未找到
        messageBus.tool(`调用工具: ${toolCall.name}`);
        messageBus.error(`   ↳ 工具未找到`);
        messages.push(
          new ToolMessage({
            content: `工具 "${toolCall.name}" 未找到`,
            tool_call_id: toolCall.id,
          })
        );
      }
    }

    // 工具执行完成，继续等待 AI 响应
    messageBus.setThinkingStatus(ThinkingStatus.WAITING, "等待 AI 响应...");
  }

  messageBus.setThinkingStatus(ThinkingStatus.IDLE);
  // 输出总耗时（达到最大迭代次数时）
  const totalDuration = Date.now() - startTime;
  messageBus.ai(`\n🕒 总耗时: ${formatDuration(totalDuration)}`);
  
  const lastMessage = messages[messages.length - 1];
  return typeof lastMessage.content === 'string' ? lastMessage.content : '';
}

export default run;
