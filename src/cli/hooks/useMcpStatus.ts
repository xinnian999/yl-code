import { useState, useEffect } from "react";
import type { Agent } from "@/core/agent.ts";
import type { McpServerState } from "@/core/mcp/index.ts";

/**
 * MCP 服务器状态订阅 hook
 * 监听 mcpManager 的 status-change 事件，实时更新各服务器状态
 */
export function useMcpStatus(agent: Agent) {
  const [serverStates, setServerStates] = useState<McpServerState[]>(
    () => agent.mcpManager.getServerStates()
  );

  useEffect(() => {
    const { mcpManager } = agent;

    /** 状态变更处理 */
    const handleChange = (states: McpServerState[]) => {
      setServerStates(states);
    };

    mcpManager.on("mcp:status-change", handleChange);

    return () => {
      mcpManager.off("mcp:status-change", handleChange);
    };
  }, [agent]);

  /** 已连接的服务器数 */
  const connectedCount = serverStates.filter((s) => s.status === "connected").length;
  /** 是否存在错误 */
  const hasErrors = serverStates.some((s) => s.status === "error");

  return { serverStates, connectedCount, totalCount: serverStates.length, hasErrors };
}
