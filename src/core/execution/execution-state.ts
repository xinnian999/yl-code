import {
  ExecutionPhase,
  ValidationStatus,
  type ExecutionStateSnapshot,
} from "./execution-types.ts";
import {
  buildFailureKey,
  extractRelatedFiles,
  formatExecutionCommand,
  formatExecutionFiles,
  getFileExecutionHint,
  hasFailureSignal,
  isDevCommand,
  isScaffoldCommand,
  isValidationCommand,
  normalizeFilePath,
  previewText,
  pushUniqueItem,
} from "./execution-helpers.ts";
import { buildExecutionPromptText } from "./execution-prompt.ts";

/** 长任务执行状态管理器 */
export class ExecutionStateManager {
  /** 当前状态快照 */
  private state: ExecutionStateSnapshot = this.createInitialState();
  /** 最近一次失败签名 */
  private lastFailureKey = "";

  /** 创建初始状态 */
  private createInitialState(): ExecutionStateSnapshot {
    return {
      taskSummary: "",
      phase: ExecutionPhase.DISCOVERY,
      focusSummary: "先阅读结构，再按阶段推进实现。",
      focusFiles: [],
      changedFilesSinceValidation: [],
      needsValidation: false,
      pendingDevLogCheck: false,
      lastValidation: null,
    };
  }

  /** 重置当前状态 */
  reset(): void {
    this.state = this.createInitialState();
    this.lastFailureKey = "";
  }

  /** 记录新的用户任务或补充说明 */
  recordUserTurn(query: string): void {
    this.state.taskSummary = previewText(query);
    if (/(报错|错误|异常|修复)/.test(query)) {
      this.state.phase = ExecutionPhase.REPAIR;
      this.state.focusSummary = "用户反馈了报错，优先读取报错相关文件和日志。";
    }
  }

  /** 记录一次工具执行结果 */
  recordToolResult(
    toolName: string,
    args: Record<string, unknown>,
    result: string
  ): void {
    if (toolName === "write_file" || toolName === "write_file_patch") {
      this.recordCodeWrite(args.filePath, result);
      return;
    }

    if (toolName === "execute_command") {
      this.recordCommand(args.command, result);
      return;
    }

    if (toolName === "read_file") {
      this.recordFileRead(args.filePath);
      return;
    }

    if (toolName === "read_background_logs") {
      this.recordBackgroundLogs(result);
    }
  }

  /** 记录文件写入结果 */
  private recordCodeWrite(filePath: unknown, result: string): void {
    const normalizedPath = normalizeFilePath(filePath);
    if (!normalizedPath) return;
    if (!/(写入成功|创建成功)/.test(result)) return;

    const hint = getFileExecutionHint(normalizedPath);
    this.state.changedFilesSinceValidation = pushUniqueItem(
      this.state.changedFilesSinceValidation,
      normalizedPath
    );
    this.state.focusFiles = [normalizedPath];
    this.state.focusSummary = hint.focusSummary;
    this.state.needsValidation = true;
    this.state.pendingDevLogCheck = false;

    if (this.state.phase !== ExecutionPhase.REPAIR) {
      this.state.phase = hint.phase;
    }
  }

  /** 记录文件读取结果 */
  private recordFileRead(filePath: unknown): void {
    const normalizedPath = normalizeFilePath(filePath);
    if (!normalizedPath) return;
    if (this.state.phase !== ExecutionPhase.REPAIR) return;
    if (this.state.focusFiles.length > 0 && !this.state.focusFiles.includes(normalizedPath)) return;
    this.state.focusFiles = [normalizedPath];
    this.state.focusSummary = `正在定位报错相关文件：${formatExecutionFiles([normalizedPath])}`;
  }

  /** 记录命令执行结果 */
  private recordCommand(command: unknown, result: string): void {
    if (typeof command !== "string" || !command.trim()) return;

    if (isScaffoldCommand(command)) {
      this.state.phase = ExecutionPhase.SCAFFOLD;
      this.state.focusSummary = `正在初始化工程环境：${formatExecutionCommand(command)}`;
    }

    if (isDevCommand(command) && /命令已在后台启动|后台命令已结束/.test(result)) {
      this.state.phase = ExecutionPhase.VALIDATION;
      this.state.pendingDevLogCheck = true;
      this.state.focusSummary = "开发服务器已启动，下一步优先检查后台日志。";
      return;
    }

    if (!isValidationCommand(command)) return;

    if (hasFailureSignal(result)) {
      this.recordValidationFailure(command, result);
      return;
    }

    this.recordValidationSuccess(command);
  }

  /** 记录验证成功 */
  private recordValidationSuccess(command: string): void {
    this.state.phase = ExecutionPhase.VALIDATION;
    this.state.focusSummary = `验证通过：${formatExecutionCommand(command)}`;
    this.state.focusFiles = [];
    this.state.changedFilesSinceValidation = [];
    this.state.needsValidation = false;
    this.state.pendingDevLogCheck = false;
    this.state.lastValidation = {
      command,
      status: ValidationStatus.PASSED,
      relatedFiles: [],
      summary: `最近一次验证已通过：${formatExecutionCommand(command)}`,
      repeatCount: 0,
    };
    this.lastFailureKey = "";
  }

  /** 记录验证失败 */
  private recordValidationFailure(command: string, result: string): void {
    const relatedFiles = extractRelatedFiles(result);
    const fallbackFiles = this.state.changedFilesSinceValidation.slice(-3);
    const focusFiles = relatedFiles.length > 0 ? relatedFiles : fallbackFiles;
    const failureKey = buildFailureKey(command, focusFiles);
    const previousCount = this.lastFailureKey === failureKey
      ? this.state.lastValidation?.repeatCount ?? 0
      : 0;
    const repeatCount = previousCount + 1;

    this.state.phase = ExecutionPhase.REPAIR;
    this.state.focusFiles = focusFiles;
    this.state.focusSummary = `最近一次验证失败，优先修复 ${formatExecutionCommand(command)} 相关问题。`;
    this.state.needsValidation = false;
    this.state.pendingDevLogCheck = false;
    this.state.lastValidation = {
      command,
      status: ValidationStatus.FAILED,
      relatedFiles: focusFiles,
      summary: previewText(result, 140),
      repeatCount,
    };
    this.lastFailureKey = failureKey;
  }

  /** 记录后台日志读取结果 */
  private recordBackgroundLogs(result: string): void {
    this.state.pendingDevLogCheck = false;
    if (!hasFailureSignal(result)) {
      if (this.state.phase === ExecutionPhase.REPAIR) return;
      this.state.phase = ExecutionPhase.VALIDATION;
      this.state.focusSummary = "后台日志未发现明显错误，可以继续页面验证或补充构建校验。";
      return;
    }

    this.state.phase = ExecutionPhase.REPAIR;
    this.state.focusFiles = extractRelatedFiles(result);
    this.state.focusSummary = "后台日志出现报错，优先根据日志定点修复。";
    this.state.lastValidation = {
      command: "read_background_logs",
      status: ValidationStatus.FAILED,
      relatedFiles: this.state.focusFiles,
      summary: previewText(result, 140),
      repeatCount: 1,
    };
  }

  /** 生成给系统提示词使用的执行状态说明 */
  buildPromptText(): string {
    return buildExecutionPromptText(this.state);
  }
}
