#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import { Agent } from "@/core/agent/Agent.ts";
import { APP_VERSION } from "@/version.ts";
import App from "./App.tsx";

// 版本查询不依赖交互终端，方便在脚本和管道中调用
if (process.argv.includes("-v") || process.argv.includes("--version")) {
  console.log(APP_VERSION);
  process.exit(0);
}

// 检查是否在 TTY 环境下运行
if (!process.stdin.isTTY) {
  console.error("❌ 请在终端中运行此程序（需要 TTY 支持）");
  console.error("   例如：pnpm start");
  process.exit(1);
}

const agent = new Agent();

process.on("SIGINT", () => agent.cleanup());
process.on("SIGTERM", () => agent.cleanup());

render(React.createElement(App, { agent }));
