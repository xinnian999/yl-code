import { ValidationStatus, type ExecutionStateSnapshot } from "./execution-types.ts";
import {
  formatExecutionCommand,
  formatExecutionFiles,
  getExecutionPhaseLabel,
} from "./execution-helpers.ts";

/** 构建给系统提示词使用的执行状态说明 */
export function buildExecutionPromptText(state: ExecutionStateSnapshot): string {
  const lines = [
    `- 当前阶段: ${getExecutionPhaseLabel(state.phase)}`,
    `- 当前任务: ${state.taskSummary || "尚未记录新的任务摘要"}`,
    `- 当前焦点: ${state.focusSummary}`,
    `- 焦点文件: ${formatExecutionFiles(state.focusFiles)}`,
    `- 待验证改动: ${formatExecutionFiles(state.changedFilesSinceValidation)}`,
  ];

  if (state.lastValidation) {
    const validationLabel = state.lastValidation.status === ValidationStatus.PASSED
      ? "通过"
      : "失败";
    lines.push(`- 最近一次验证: ${formatExecutionCommand(state.lastValidation.command)}（${validationLabel}）`);
  }

  lines.push("- 当前执行策略:");

  if (state.pendingDevLogCheck) {
    lines.push("  - 开发服务器刚启动，下一步优先调用 read_background_logs，不要直接猜测页面报错原因。");
  }
  if (state.lastValidation?.status === ValidationStatus.FAILED) {
    lines.push("  - 最近一次验证失败后，优先读取和修改报错相关文件；没有新证据前，不要重写无关模块。");
  }
  if (state.needsValidation) {
    lines.push("  - 当前已有代码改动尚未验证；完成当前这一组强相关文件后，优先执行 bun run build。");
  }
  if ((state.lastValidation?.repeatCount ?? 0) >= 2) {
    lines.push("  - 同一批错误已连续失败多次，继续动手前先用简短文本总结根因和下一步修改点。");
  }
  if (!state.pendingDevLogCheck && !state.lastValidation && !state.needsValidation) {
    lines.push("  - 大任务按“脚手架 -> 基础结构 -> 单模块实现 -> 联调验证”推进，一次只处理一个模块或一组强相关文件。");
  }

  return lines.join("\n");
}
