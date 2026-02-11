/**
 * 斜杠命令配置
 * 定义所有可用的斜杠命令
 */

export interface Command {
  value: string;  // 命令标识
  label: string;  // 显示文本
}

export const commands: Command[] = [
  { value: "model", label: "/model    切换 AI 模型" },
  { value: "clear", label: "/clear    清空对话历史" },
  { value: "help",  label: "/help     显示帮助信息" },
  { value: "exit",  label: "/exit     退出程序" },
];
