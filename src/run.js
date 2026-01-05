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
import logger from "./utils/logger.js";

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

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.BASE_URL,
  },
}).bindTools(tools);

const messages = [new SystemMessage(systemPrompt)];

// Agent 执行函数
async function run(query, maxIterations = 30) {
  messages.push(new HumanMessage(query));

  for (let i = 0; i < maxIterations; i++) {
    const response = await logger.withLoading({
      promise: model.invoke(messages),
      message: "玩命思考中，稍安勿躁...🐂🐎🐂",
      interval: 100
    });

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

    messages.push(messageToAdd); // 检查是否有工具调用

    // 如果没有工具调用，直接返回内容
    if (!response.tool_calls || response.tool_calls.length === 0) {
      logger.ai(response.content || "");
      return response.content || "";
    } 

    // 执行工具调用
    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args);

        messages.push(
          new ToolMessage({
            content: toolResult,
            tool_call_id: toolCall.id,
          })
        );
      }
    }
  }

  return messages[messages.length - 1].content;
}

export default run;

