/** 斜杠命令静态配置 */
export const COMMANDS: Array<{ value: string; description: string }> = [
  { value: "new", description: "开始新对话" },
  { value: "history", description: "查看对话历史" },
  { value: "model", description: "切换 AI 模型" },
  { value: "mcp", description: "管理 MCP 服务器" },
  { value: "debug", description: "开关调试模式" },
  { value: "stream", description: "开关流式输出" },
  { value: "clear", description: "清空对话历史" },
  { value: "help", description: "显示帮助信息" },
  { value: "exit", description: "退出程序" },
];

/** 帮助信息静态文本 */
export const COMMAND_HELP_TEXT = `📖 可用命令：

/new     - 开始新对话
/history - 查看对话历史
/model   - 切换 AI 模型
/mcp     - 管理 MCP 服务器
/debug   - 开关调试模式（实时查看流式 chunk）
/stream  - 开关流式输出
/clear   - 清空对话历史
/help    - 显示帮助信息
/exit    - 退出程序

其他：
- 输入 exit 或 quit 也可退出
- 按 ↑↓ 键可切换历史命令
- 按 Ctrl+C 强制退出
- 输入 @ 可引用文件/目录`;
