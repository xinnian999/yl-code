import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import {
  HumanMessage,
  SystemMessage,
  ToolMessage,
  AIMessage,
} from "@langchain/core/messages";
import chalk from "chalk";
import {
  executeCommandTool,
  listDirectoryTool,
  readFileTool,
  writeFileTool,
} from "./all-tools.mjs";
import readline from "readline";

const model = new ChatOpenAI({
  modelName: process.env.MODEL_NAME,
  apiKey: process.env.API_KEY,
  temperature: 0,
  configuration: {
    baseURL: process.env.BASE_URL,
  },
});

const tools = [
  readFileTool,
  writeFileTool,
  executeCommandTool,
  listDirectoryTool,
];

// 绑定工具到模型
const modelWithTools = model.bindTools(tools);

// Agent 执行函数
async function runAgentWithTools(query, maxIterations = 30) {
  const messages = [
    new SystemMessage(`你是一个项目管理助手，使用工具完成任务。
    
    当前工作目录: ${process.cwd()}
    
    工具：
    1. read_file: 读取文件
    2. write_file: 写入文件
    3. execute_command: 执行命令（支持 workingDirectory 参数）
    4. list_directory: 列出目录

重要规则 - execute_command：
- workingDirectory 参数会自动切换到指定目录
- 当使用 workingDirectory 时，绝对不要在 command 中使用 cd
- 错误示例: { command: "cd react-todo-app && pnpm install", workingDirectory: "react-todo-app" }
这是错误的！因为 workingDirectory 已经在 react-todo-app 目录了，再 cd react-todo-app 会找不到目录
- 正确示例: { command: "pnpm install", workingDirectory: "react-todo-app" }
这样就对了！workingDirectory 已经切换到 react-todo-app，直接执行命令即可

⚠️ 交互式命令处理：
- 对于 pnpm create vite，必须使用非交互式参数：
  * ✅ 正确: { command: "pnpm create vite vue-todo-app --template vue-ts --no-rolldown --no-interactive" }
  * ❌ 错误: { command: "pnpm create vite vue-todo-app --template vue-ts" }（会卡住）

回复要简洁，只说做了什么`),
    new HumanMessage(query),
  ];

  for (let i = 0; i < maxIterations; i++) {
    console.log(`⏳ 正在等待 AI 思考...`);
    const response = await modelWithTools.invoke(messages);
    // console.log(response);

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

    if (!response.tool_calls || response.tool_calls.length === 0) {
      console.log(`\n✨ AI 最终回复:\n${response.content || ""}\n`);
      return response.content || "";
    } // 执行工具调用

    for (const toolCall of response.tool_calls) {
      const foundTool = tools.find((t) => t.name === toolCall.name);
      if (foundTool) {
        const toolResult = await foundTool.invoke(toolCall.args);

        console.log('🔧 ' + chalk.bgGreenBright(toolResult + "\n"));

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

// 交互式对话
async function interactiveMode() {
  console.log("🤖 你好！我是mini-cursor！有什么吩咐？\n");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.prompt();

  rl.on("line", async (input) => {
    const trimmedInput = input.trim();

    // 检查退出命令
    if (
      trimmedInput.toLowerCase() === "exit" ||
      trimmedInput.toLowerCase() === "quit"
    ) {
      console.log("👋 再见！");
      rl.close();
      return;
    }

    // 跳过空输入
    if (!trimmedInput) {
      rl.prompt();
      return;
    }

    try {
      await runAgentWithTools(trimmedInput);

      rl.prompt();
    } catch (error) {
      console.error(`\n❌ 错误: ${error.message}\n`);
    }
  });
}

interactiveMode();
