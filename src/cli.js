#!/usr/bin/env node

import run from "./run.js";
import readline from "readline";
import { cleanup } from "./utils/process-manager.js";
import logger from "./utils/logger.js";

const welcomeMessage = `您好老板！

我是您的专属 🐂 牛码 🐎 ；

我擅长写代码、改BUG等；

我喜欢干各种关于代码的脏活累活；

有什么可以为您效劳的？😊`;

// 交互式对话
async function interactiveMode() {
  logger.ai(welcomeMessage);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // 监听退出信号
  process.on("SIGINT", () => {
    console.log("\n");
    cleanup();
  });

  process.on("SIGTERM", () => {
    cleanup();
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
      cleanup();
      return;
    }

    // 跳过空输入
    if (!trimmedInput) {
      rl.prompt();
      return;
    }

    // 用户消息后空一行
    console.log();

    try {
      await run(trimmedInput);
    } catch (error) {
      // 打印完整的错误信息，包括堆栈跟踪
      if (error) {
        logger.error(`错误: ${error.message || String(error)}`);
        if (error.stack) {
          logger.error(`堆栈跟踪:\n${error.stack}`);
        }
        
        if (error.message && error.message.includes("pass an `apiKey`")) {
          logger.error(`未配置 API_KEY`);
        }
      } else {
        logger.error(`未知错误: ${String(error)}`);
      }
    } finally {
      rl.prompt();
    }
  });
}

interactiveMode();

