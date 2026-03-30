import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { Agent } from "@/core/agent/Agent.ts";
import { openFileInEditor } from "@/core/editor-detector.ts";
import { getTransport } from "@/core/mcp/index.ts";
import type { McpServerConfig } from "@/core/mcp/index.ts";
import {
  clampSelectedIndex,
  getNextSelectedIndex,
} from "./list-helpers.ts";
import SelectableList from "./SelectableList.tsx";
import { useMcpStatus } from "./useMcpStatus.ts";

/** MCP 面板属性 */
export interface McpPanelProps {
  /** Agent 实例 */
  agent: Agent;
  /** 关闭回调 */
  onClose: () => void;
}

/** 状态文字映射 */
const STATUS_TEXT: Record<string, string> = {
  connected: "已连接",
  connecting: "连接中",
  error: "错误",
  disconnected: "未连接",
};

/** 格式化服务器列表项文本 */
function formatServerLabel(
  server: McpServerConfig,
  serverStates: ReturnType<typeof useMcpStatus>["serverStates"],
): string {
  if (server.disabled) {
    return `${server.name} | 已禁用`;
  }

  const state = serverStates.find(
    (serverState) => serverState.config.name === server.name,
  );
  const status = state?.status || "disconnected";
  const toolCount = state?.toolCount || 0;
  const transport = getTransport(server);
  const toolInfo = status === "connected" ? ` (${toolCount} 工具)` : "";

  return `${server.name} | ${transport} | ${STATUS_TEXT[status] || "未连接"}${toolInfo}`;
}

/** MCP 面板 */
const McpPanel: React.FC<McpPanelProps> = ({ agent, onClose }) => {
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [servers, setServers] = useState<McpServerConfig[]>(() => {
    return agent.mcpConfig.getServers();
  });
  const { serverStates } = useMcpStatus(agent);

  const items = useMemo(() => {
    return servers.map((server) => ({
      id: server.name,
      label: formatServerLabel(server, serverStates),
    }));
  }, [serverStates, servers]);

  useEffect(() => {
    /** 处理 MCP 配置变化 */
    const updateServers = () => {
      setServers(agent.mcpConfig.getServers());
    };

    agent.mcpConfig.on("mcp:config-change", updateServers);
    return () => {
      agent.mcpConfig.off("mcp:config-change", updateServers);
    };
  }, [agent]);

  useEffect(() => {
    setSelectedIndex((currentIndex) => {
      return clampSelectedIndex(currentIndex, servers.length);
    });
  }, [servers.length]);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((currentIndex) => {
        return getNextSelectedIndex(currentIndex, servers.length, "up");
      });
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((currentIndex) => {
        return getNextSelectedIndex(currentIndex, servers.length, "down");
      });
      return;
    }

    if (input.toLowerCase() === "t" && servers.length > 0) {
      const server = servers[selectedIndex];
      if (server) {
        agent.mcpConfig.toggleServer(server.name);
      }
      return;
    }

    if (input.toLowerCase() === "o") {
      agent.mcpConfig.ensureConfigFile();
      const editorName = openFileInEditor(agent.mcpConfig.getConfigPath());
      if (editorName) {
        setStatusMessage(`已在 ${editorName} 中打开配置文件，编辑后按 r 重连`);
      } else {
        setStatusMessage(`配置文件路径: ${agent.mcpConfig.getConfigPath()}`);
      }
      return;
    }

    if (input.toLowerCase() !== "r") {
      return;
    }

    agent.mcpConfig.reload();
    setStatusMessage("正在重连...");
    agent.reconnectMcp().then(() => setStatusMessage(null));
  });

  return (
    <SelectableList
      title="🔌 MCP 服务器管理 (↑↓ 移动, Esc 返回)"
      items={items}
      selectedIndex={selectedIndex}
      emptyText="暂无 MCP 服务器，按 o 编辑 JSON 配置"
      footer={
        <Box flexDirection="column">
          {statusMessage ? (
            <Box marginBottom={1}>
              <Text color="yellow">{statusMessage}</Text>
            </Box>
          ) : null}
          {serverStates.some((state) => state.status === "error") ? (
            <Box flexDirection="column" marginBottom={1}>
              {serverStates
                .filter((state) => state.status === "error")
                .map((state) => (
                  <Text key={state.config.name} color="red">
                    {"  "}⚠ {state.config.name}: {state.error}
                  </Text>
                ))}
            </Box>
          ) : null}
          <Text dimColor>
            <Text color="cyan">t</Text> 启用/禁用 |{" "}
            <Text color="cyan">o</Text> 编辑JSON |{" "}
            <Text color="cyan">r</Text> 重连
          </Text>
        </Box>
      }
    />
  );
};

export default McpPanel;
