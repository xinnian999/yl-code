import { EventEmitter } from "events";

// ============ 计划交互数据 ============

/** 计划问题的单个选项 */
export interface PlanQuestionOption {
  /** 选项标题 */
  label: string;
  /** 选项描述 */
  description: string;
}

/** 计划问题请求 */
export interface PlanQuestionRequest {
  /** 问题标题 */
  title: string;
  /** 问题正文 */
  question: string;
  /** 候选选项列表 */
  options: PlanQuestionOption[];
}

/** 待处理的计划问题 */
export interface PendingPlanQuestion extends PlanQuestionRequest {
  /** 交互唯一 ID */
  id: string;
  /** 交互类型 */
  type: "question";
}

/** 待处理的计划预览 */
export interface PendingPlanPreview {
  /** 交互唯一 ID */
  id: string;
  /** 交互类型 */
  type: "preview";
  /** 预览标题 */
  title: string;
  /** 计划 Markdown 内容 */
  planMarkdown: string;
}

/** 当前等待中的计划交互 */
export type PendingPlanInteraction =
  | PendingPlanQuestion
  | PendingPlanPreview;

/** 计划问题的回答结果 */
export interface PlanQuestionAnswer {
  /** 回传给模型的回答文本 */
  answer: string;
  /** 展示给用户的文本 */
  displayText: string;
  /** 是否来自自定义输入 */
  isCustom: boolean;
}

/** 计划预览的处理结果 */
export type PlanPreviewResult =
  | { action: "execute" }
  | { action: "revise"; feedback: string }
  | { action: "cancel" };

/** 计划交互的统一返回结果 */
type PlanInteractionResult = PlanQuestionAnswer | PlanPreviewResult;

// ============ 事件类型 ============

/** 计划交互总线事件定义 */
interface PlanBusEvents {
  /** 出现新的计划交互时触发 */
  "pending-interaction": (interaction: PendingPlanInteraction) => void;
  /** 计划交互被处理后触发 */
  "interaction-resolved": (id: string) => void;
}

// ============ 计划交互总线 ============

/**
 * 计划交互总线
 * 管理计划模式中的选项提问与计划预览确认流程
 */
export class PlanBus extends EventEmitter {
  /** 等待中的交互解析器 */
  private pendingResolvers = new Map<
    string,
    (result: PlanInteractionResult) => void
  >();
  /** 交互 ID 计数器 */
  private interactionIdCounter = 0;
  /** 累计等待用户交互的时间 */
  private _totalWaitTime = 0;
  /** 当前等待开始时间 */
  private _waitStartTime: number | null = null;

  /** 生成唯一交互 ID */
  private generateId(): string {
    this.interactionIdCounter++;
    return `plan-${this.interactionIdCounter}-${Date.now()}`;
  }

  /** 当前累计等待时间 */
  get totalWaitTime(): number {
    return this._totalWaitTime;
  }

  /** 获取包含当前等待中的累计时间 */
  getCurrentWaitTime(): number {
    if (this._waitStartTime === null) {
      return this._totalWaitTime;
    }
    return this._totalWaitTime + (Date.now() - this._waitStartTime);
  }

  /** 重置会话状态 */
  resetSession(): void {
    this.pendingResolvers.clear();
    this.interactionIdCounter = 0;
    this._totalWaitTime = 0;
    this._waitStartTime = null;
  }

  /** 重置等待计时 */
  resetWaitTime(): void {
    this._totalWaitTime = 0;
    this._waitStartTime = null;
  }

  /** 请求用户回答计划问题 */
  requestQuestion(
    request: PlanQuestionRequest
  ): Promise<PlanQuestionAnswer> {
    const interaction: PendingPlanQuestion = {
      id: this.generateId(),
      type: "question",
      title: request.title,
      question: request.question,
      options: request.options,
    };
    this._waitStartTime = Date.now();

    return new Promise((resolve) => {
      this.pendingResolvers.set(interaction.id, (result) => {
        resolve(result as PlanQuestionAnswer);
      });
      this.emit("pending-interaction", interaction);
    });
  }

  /** 请求用户预览并处理计划 */
  requestPlanPreview(
    title: string,
    planMarkdown: string
  ): Promise<PlanPreviewResult> {
    const interaction: PendingPlanPreview = {
      id: this.generateId(),
      type: "preview",
      title,
      planMarkdown,
    };
    this._waitStartTime = Date.now();

    return new Promise((resolve) => {
      this.pendingResolvers.set(interaction.id, (result) => {
        resolve(result as PlanPreviewResult);
      });
      this.emit("pending-interaction", interaction);
    });
  }

  /** 结束当前计划交互并回传结果 */
  resolveInteraction(id: string, result: PlanInteractionResult): void {
    const resolver = this.pendingResolvers.get(id);
    if (!resolver) return;

    if (this._waitStartTime !== null) {
      this._totalWaitTime += Date.now() - this._waitStartTime;
      this._waitStartTime = null;
    }

    resolver(result);
    this.pendingResolvers.delete(id);
    this.emit("interaction-resolved", id);
  }

  /** 类型安全的事件订阅 */
  on<K extends keyof PlanBusEvents>(
    event: K,
    listener: PlanBusEvents[K]
  ): this {
    return super.on(event, listener);
  }

  /** 类型安全的事件取消订阅 */
  off<K extends keyof PlanBusEvents>(
    event: K,
    listener: PlanBusEvents[K]
  ): this {
    return super.off(event, listener);
  }

  /** 类型安全的事件触发 */
  emit<K extends keyof PlanBusEvents>(
    event: K,
    ...args: Parameters<PlanBusEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
