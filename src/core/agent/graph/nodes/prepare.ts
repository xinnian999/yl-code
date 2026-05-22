import { HumanMessage } from "@langchain/core/messages";
import { compactMessagesForContext } from "../../../context/compaction.ts";
import type { AgentGraphState } from "../state.ts";
import type { AgentGraphDeps } from "../deps.ts";

/** 拼装用户消息正文，附加 @ 引用的文件上下文 */
function buildMessageContent(query: string, fileContext: string): string {
  if (!fileContext) return query;
  return `${query}\n\n【用户引用的文件内容如下，请根据这些内容完成任务】${fileContext}`;
}

/**
 * 准备节点：进入主循环前的一次性初始化。
 * 1. 压缩历史 tool 结果；
 * 2. 记录用户回合到执行状态；
 * 3. 刷新系统提示词；
 * 4. 推入本轮用户消息并新建助手轮次。
 */
export function createPrepareNode(deps: AgentGraphDeps) {
  return async (state: AgentGraphState): Promise<Partial<AgentGraphState>> => {
    deps.confirmBus.resetSkipConfirm();
    deps.planBus.resetWaitTime();
    compactMessagesForContext(state.messages);
    deps.executionState.recordUserTurn(state.userQuery);
    deps.refreshSystemPrompt();

    state.messages.push(
      new HumanMessage(buildMessageContent(state.userQuery, state.fileContext))
    );
    deps.beginAssistantTurn();

    return { messages: state.messages };
  };
}
