/**
 * 斜杠命令配置
 * 定义所有可用的斜杠命令
 */
import { COMMAND_HELP_TEXT, COMMANDS } from "./config/command-config.ts";

/** 命令定义 */
export interface Command {
  value: string;        // 命令标识
  description: string;  // 命令描述
}

/** 命令执行后 UI 需要响应的动作 */
export type CommandAction =
  | { action: "none" }
  | { action: "select_model" }
  | { action: "show_history" }
  | { action: "manage_mcp" }
  | { action: "exit" };

/** 所有斜杠命令列表 */
export const commands: Command[] = [...COMMANDS];

/** 帮助信息文本 */
export const HELP_TEXT = COMMAND_HELP_TEXT;
