import run from "./run.mjs";
import readline from "readline";
import chalk from "chalk";
import { cleanup } from "./process-manager.mjs";

// 交互式对话
async function interactiveMode() {
  console.log(chalk.greenBright("🤖 你好！我是mini-cursor！有什么吩咐？\n"));

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

    try {
      await run(trimmedInput);

      rl.prompt();
    } catch (error) {
      console.error(`\n❌ 错误: ${error.message}\n`);
    }
  });
}

interactiveMode();
