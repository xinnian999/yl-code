import { Command, END } from "@langchain/langgraph";
import { handlePlanModeResponse } from "../../plan-mode.ts";
import type { AgentGraphState } from "../state.ts";
import type { AgentGraphDeps } from "../deps.ts";

/** 提取响应文本内容 */
function getResponseContent(response: any): string {
  if (typeof response?.content === "string") return response.content;
  if (!response?.content) return "";
  return JSON.stringify(response.content);
}

/** 计划交互后的下一步路由 */
function nextGoto(action: "continue" | "break", hasToolCalls: boolean) {
  if (action === "break") return END;
  return hasToolCalls ? "tools" : "model";
}

/**
 * 计划模式交互节点：解析模型响应中的 plan_question / plan_preview 块，
 * 通过 PlanBus 等待用户回答或确认，再决定下一步去模型 / 工具 / 结束。
 */
export function createPlanInteractNode(deps: AgentGraphDeps) {
  return async (state: AgentGraphState) => {
    const lastResponse = state.messages[state.messages.length - 1] as any;

    const action = await handlePlanModeResponse(
      {
        debugMode: deps.isDebugMode(),
        messageBus: deps.messageBus,
        planBus: deps.planBus,
        chatMessages: state.messages,
        getResponseContent,
        beginAssistantTurn: () => deps.beginAssistantTurn(),
        setMode: (mode) => deps.setMode(mode),
      },
      lastResponse
    );

    const hasToolCalls = lastResponse?.tool_calls?.length > 0;
    return new Command({
      goto: nextGoto(action, hasToolCalls),
      update: {
        messages: state.messages,
        mode: deps.getMode(),
      },
    });
  };
}
