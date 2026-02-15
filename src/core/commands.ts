/**
 * 斜杠命令配置
 * 定义所有可用的斜杠命令
 */

/** 命令定义 */
export interface Command {
  value: string;  // 命令标识
  label: string;  // 显示文本
}

/** 命令执行后 UI 需要响应的动作 */
export type CommandAction =
  | { action: "none" }
  | { action: "select_model" }
  | { action: "exit" };

/** 所有斜杠命令列表 */
export const commands: Command[] = [
  { value: "model", label: "/model    切换 AI 模型" },
  { value: "clear", label: "/clear    清空对话历史" },
  { value: "help",  label: "/help     显示帮助信息" },
  { value: "exit",  label: "/exit     退出程序" },
];

/** 帮助信息文本 */
export const HELP_TEXT = `📖 可用命令：

/model  - 切换 AI 模型
/clear  - 清空对话历史
/help   - 显示帮助信息
/exit   - 退出程序

其他：
- 输入 exit 或 quit 也可退出
- 按 ↑↓ 键可切换历史命令
- 按 Ctrl+C 强制退出
- 输入 @ 可引用文件/目录`;
