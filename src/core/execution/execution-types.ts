/** 执行阶段常量 */
export const ExecutionPhase = {
  DISCOVERY: "discovery",
  SCAFFOLD: "scaffold",
  FOUNDATION: "foundation",
  MODULE: "module",
  VALIDATION: "validation",
  REPAIR: "repair",
  COMPLETE: "complete",
} as const;

/** 执行阶段值类型 */
export type ExecutionPhaseValue =
  (typeof ExecutionPhase)[keyof typeof ExecutionPhase];

/** 验证结果状态 */
export const ValidationStatus = {
  PASSED: "passed",
  FAILED: "failed",
} as const;

/** 验证结果状态值类型 */
export type ValidationStatusValue =
  (typeof ValidationStatus)[keyof typeof ValidationStatus];

/** 最近一次验证信息 */
export interface ValidationState {
  /** 验证命令 */
  command: string;
  /** 验证状态 */
  status: ValidationStatusValue;
  /** 报错相关文件 */
  relatedFiles: string[];
  /** 验证摘要 */
  summary: string;
  /** 同类失败连续出现次数 */
  repeatCount: number;
}

/** 长任务执行状态快照 */
export interface ExecutionStateSnapshot {
  /** 当前任务摘要 */
  taskSummary: string;
  /** 当前阶段 */
  phase: ExecutionPhaseValue;
  /** 当前聚焦说明 */
  focusSummary: string;
  /** 当前聚焦文件 */
  focusFiles: string[];
  /** 自上次验证后改动的文件 */
  changedFilesSinceValidation: string[];
  /** 是否存在待验证改动 */
  needsValidation: boolean;
  /** 是否需要优先检查开发服务器日志 */
  pendingDevLogCheck: boolean;
  /** 最近一次验证信息 */
  lastValidation: ValidationState | null;
}
