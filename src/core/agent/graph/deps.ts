import type { ChatOpenAI } from "@langchain/openai";
import type { ConfigManager } from "../../config/config-manager.ts";
import type { MessageBus } from "../../message-bus.ts";
import type { ConfirmBus } from "../../confirm-bus.ts";
import type { TodoBus } from "../../todo-bus.ts";
import type { ContextBus } from "../../context/context-bus.ts";
import type { PlanBus } from "../../plan/plan-bus.ts";
import type { ExecutionStateManager } from "../../execution/execution-state.ts";
import type { ModeTool } from "../../tooling/types.ts";
import type { AgentModeValue } from "../../types.ts";

/**
 * Agent 图节点共享的依赖端口。
 * 由 Agent 实例在构图时一次性注入，节点通过 getter 拿到最新引用，
 * 不直接依赖 Agent 类，保持 core 与 UI 解耦。
 */
export interface AgentGraphDeps {
  /** 消息总线 */
  readonly messageBus: MessageBus;
  /** 确认总线 */
  readonly confirmBus: ConfirmBus;
  /** 计划交互总线 */
  readonly planBus: PlanBus;
  /** 任务总线 */
  readonly todoBus: TodoBus;
  /** 上下文总线 */
  readonly contextBus: ContextBus;
  /** 配置管理器 */
  readonly config: ConfigManager;
  /** 长任务执行状态管理器 */
  readonly executionState: ExecutionStateManager;
  /** 获取当前工具列表（MCP 重连后会变化） */
  getTools(): ModeTool[];
  /** 是否启用调试模式 */
  isDebugMode(): boolean;
  /** 是否启用流式输出 */
  isStreamEnabled(): boolean;
  /** 获取已绑定工具的模型实例（模型变更后会重建） */
  getModel(): ReturnType<ChatOpenAI["bindTools"]>;
  /** 获取当前中断控制器（每轮对话开始重建） */
  getAbortController(): AbortController | null;
  /** 当前工作模式 */
  getMode(): AgentModeValue;
  /** 切换工作模式（plan 节点确认计划后调用） */
  setMode(mode: AgentModeValue): void;
  /** 刷新系统提示词（写入 messages[0]） */
  refreshSystemPrompt(): void;
  /** 创建新的 AI 消息块（用于轮次切换） */
  beginAssistantTurn(): void;
}
