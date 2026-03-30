import { useEffect, useState } from "react";
import type { Agent } from "@/core/agent/Agent.ts";
import type { McpServerState } from "@/core/mcp/index.ts";

/** MCP 状态订阅结果 */
export interface UseMcpStatusResult {
  /** 当前服务器状态 */
  serverStates: McpServerState[];
  /** 已连接数量 */
  connectedCount: number;
  /** 总数量 */
  totalCount: number;
  /** 是否存在错误 */
  hasErrors: boolean;
}

/** MCP 服务器状态订阅 hook */
export function useMcpStatus(agent: Agent): UseMcpStatusResult {
  const [serverStates, setServerStates] = useState<McpServerState[]>(() => {
    return agent.mcpManager.getServerStates();
  });

  useEffect(() => {
    /** 状态变更处理 */
    const handleChange = (states: McpServerState[]) => {
      setServerStates(states);
    };

    agent.mcpManager.on("mcp:status-change", handleChange);
    return () => {
      agent.mcpManager.off("mcp:status-change", handleChange);
    };
  }, [agent]);

  return {
    serverStates,
    connectedCount: serverStates.filter((state) => state.status === "connected")
      .length,
    totalCount: serverStates.length,
    hasErrors: serverStates.some((state) => state.status === "error"),
  };
}
