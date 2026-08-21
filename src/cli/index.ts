#!/usr/bin/env node

import React from "react";
import { render } from "ink";
import { Agent } from "@/core/agent/Agent.ts";
import App from "./App.tsx";

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
