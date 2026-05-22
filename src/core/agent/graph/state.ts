import { Annotation } from "@langchain/langgraph";
import type { BaseMessage } from "@langchain/core/messages";
import type { AgentModeValue } from "../../types.ts";

/** 通用替换 reducer：节点每次返回完整值 */
function replaceReducer<T>(_current: T, update: T): T {
  return update;
}

/**
 * Agent 主循环图的运行状态。
 * messages 与 Agent.chatMessages 共享同一数组引用，
 * 节点对 state.messages 的原地修改会同步反映到 Agent 实例。
 */
export const AgentStateAnnotation = Annotation.Root({
  /** 对话消息历史（原地修改 + 替换 reducer） */
  messages: Annotation<BaseMessage[]>({
    reducer: replaceReducer,
    default: () => [],
  }),
  /** 当前工作模式（plan 节点确认计划后可能切到 build） */
  mode: Annotation<AgentModeValue>({
    reducer: replaceReducer,
  }),
  /** 本轮用户输入原文（prepare 节点消费） */
  userQuery: Annotation<string>({
    reducer: replaceReducer,
    default: () => "",
  }),
  /** 本轮 @ 引用拼接出的文件上下文（prepare 节点消费） */
  fileContext: Annotation<string>({
    reducer: replaceReducer,
    default: () => "",
  }),
});

/** Agent 图状态类型 */
export type AgentGraphState = typeof AgentStateAnnotation.State;
