#!/usr/bin/env bun

import React from "react";
import { render } from "ink";
import App from "./App.tsx";
import { cleanup } from "@/utils/process-manager.ts";

// 检查是否在 TTY 环境下运行
if (!process.stdin.isTTY) {
  console.error("❌ 请在终端中运行此程序（需要 TTY 支持）");
  console.error("   例如：bun src/cli.js");
  process.exit(1);
}

// 监听退出信号
process.on("SIGINT", () => {
  cleanup();
});

process.on("SIGTERM", () => {
  cleanup();
});

// 渲染 TUI
render(React.createElement(App));
