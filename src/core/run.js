import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  AIMessage,
} from "@langchain/core/messages";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import tools from "./tools.js";
import messageBus, { ThinkingStatus } from "@/utils/message-bus.js";

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

const messages = [new SystemMessage(systemPrompt)];

/**
 * 格式化耗时
 * @param {number} ms - 毫秒数
 * @returns {string} 格式化后的时间字符串
 */
const formatDuration = (ms) => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

/**
 * 获取工具调用的描述信息
 * @param {string} toolName - 工具名称
 * @param {object} args - 工具参数
 * @returns {string} 工具描述
 */
const getToolDescription = (toolName, args) => {
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

// Agent 执行函数
async function run(query, maxIterations = 30) {
  const startTime = Date.now(); // 记录总开始时间

  messages.push(new HumanMessage(query));

  // 创建一个 AI 消息来承载所有输出（工具调用、最终响应等）
  messageBus.createAIMessage();

  for (let i = 0; i < maxIterations; i++) {
    // 记录本轮迭代开始时间（包含思考+工具执行）
    const iterationStartTime = Date.now();

    // 设置思考状态
    messageBus.setThinkingStatus(ThinkingStatus.THINKING, "玩命思考中...🐂🐎");

    let response;
    try {
      // 创建带超时的 Promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`API 请求超时（${timeout / 1000}秒），请检查网络连接或稍后重试`)),
          timeout
        )
      );

      response = await Promise.race([
        model.invoke(messages),
        timeoutPromise,
      ]);
    } catch (error) {
      // 清除思考状态
      messageBus.setThinkingStatus(ThinkingStatus.IDLE);

      // 处理 API 调用错误
      const errorMessage = error?.message || error?.error?.message || String(error);
      const errorDetails = error?.error || error?.response?.data || error;
      
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
      detailedError.cause = error;
      throw detailedError;
    }

    // 如果 content 为空且有工具调用，创建一个新的 AIMessage 确保 content 不为空
    let messageToAdd = response;
    if (
      (!response.content || response.content.trim() === "") &&
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
      messageBus.endAIMessage();
      return response.content || "";
    }

    // 执行工具调用
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);

      // 更新思考状态：正在调用工具
      messageBus.setThinkingStatus(
        ThinkingStatus.TOOL_CALLING,
        `正在执行工具: ${toolCall.name}`
      );

      if (foundTool) {
        try {
          const toolResult = await foundTool.invoke(toolCall.args);
          const toolDuration = Date.now() - iterationStartTime; // 从本轮开始计算耗时

          // 输出工具调用信息和耗时
          const toolDesc = getToolDescription(toolCall.name, toolCall.args);
          messageBus.tool(`${toolDesc} (耗时: ${formatDuration(toolDuration)})`);

          messages.push(
            new ToolMessage({
              content: toolResult,
              tool_call_id: toolCall.id,
            })
          );
        } catch (error) {
          const toolDuration = Date.now() - iterationStartTime;
          const toolDesc = getToolDescription(toolCall.name, toolCall.args);
          // 工具执行失败，将错误信息作为 ToolMessage 返回
          const errorMessage = error?.message || String(error);
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
  messageBus.endAIMessage();
  return messages[messages.length - 1].content;
}

export default run;
