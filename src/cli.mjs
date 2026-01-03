import run from "./run.mjs";
import readline from "readline";

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
      await run(trimmedInput);

      rl.prompt();
    } catch (error) {
      console.error(`\n❌ 错误: ${error.message}\n`);
    }
  });
}

interactiveMode();
