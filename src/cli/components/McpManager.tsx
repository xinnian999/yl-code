import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import { ScrollList } from "ink-scroll-list";
import type { Agent } from "@/core/agent.ts";
import { getTransport } from "@/core/mcp/index.ts";
import type { McpServerConfig } from "@/core/mcp/index.ts";
import { openFileInEditor } from "@/core/editor-detector.ts";
import { useMcpStatus } from "../hooks/useMcpStatus.ts";

/** MCP 管理组件属性 */
interface Props {
  agent: Agent;
  onClose: () => void;
}

/** 状态文字映射 */
const STATUS_TEXT: Record<string, string> = {
  connected: "已连接", connecting: "连接中", error: "错误", disconnected: "未连接",
};

/** 可滚动列表的最大可见高度 */
const LIST_HEIGHT = 12;

/**
 * MCP 服务器管理组件
 * 显示服务器列表和连接状态，支持编辑 JSON 配置和重连
 * 快捷键：t 启用/禁用、o 编辑JSON、r 重连、Esc 返回
 */
const McpManager: React.FC<Props> = ({ agent, onClose }) => {
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [servers, setServers] = useState<McpServerConfig[]>(() => agent.mcpConfig.getServers());
  const { serverStates } = useMcpStatus(agent);

  // 订阅配置变更，实时刷新服务器列表
  useEffect(() => {
    const update = () => setServers(agent.mcpConfig.getServers());
    agent.mcpConfig.on("mcp:config-change", update);
    return () => { agent.mcpConfig.off("mcp:config-change", update); };
  }, [agent]);

  useInput((input, key) => {
    if (key.escape) { onClose(); return; }

    // 上下键导航
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, servers.length - 1));
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
        setStatusMsg(`已在 ${editorName} 中打开配置文件，编辑后按 r 重连`);
      } else {
        setStatusMsg(`配置文件路径: ${agent.mcpConfig.getConfigPath()}`);
      }
      return;
    }

    if (input.toLowerCase() === "r") {
      agent.mcpConfig.reload();
      setStatusMsg("正在重连...");
      agent.reconnectMcp().then(() => setStatusMsg(null));
      return;
    }
  });

  /** 格式化服务器列表项文本 */
  const formatServerLabel = (server: McpServerConfig): string => {
    if (server.disabled) {
      return `${server.name} | 已禁用`;
    }
    const state = serverStates.find((s) => s.config.name === server.name);
    const status = state?.status || "disconnected";
    const toolCount = state?.toolCount || 0;
    const transport = getTransport(server);
    const toolInfo = status === "connected" ? ` (${toolCount} 工具)` : "";
    return `${server.name} | ${transport} | ${STATUS_TEXT[status] || "未连接"}${toolInfo}`;
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>
        🔌 MCP 服务器管理 (↑↓ 移动, Esc 返回)
      </Text>
      {servers.length === 0 ? (
        <Box marginY={1}><Text dimColor>暂无 MCP 服务器，按 o 编辑 JSON 配置</Text></Box>
      ) : (
        <Box borderStyle="single" borderTop borderBottom borderLeft={false} borderRight={false}
          marginTop={1} marginBottom={1} height={LIST_HEIGHT}>
          <ScrollList selectedIndex={selectedIndex}>
            {servers.map((server, i) => (
              <Box key={server.name} paddingX={1}>
                <Text color={i === selectedIndex ? "green" : ""}>
                  {i === selectedIndex ? "> " : "  "}
                  {formatServerLabel(server)}
                </Text>
              </Box>
            ))}
          </ScrollList>
        </Box>
      )}
      {statusMsg && (
        <Box marginBottom={1}><Text color="yellow">{statusMsg}</Text></Box>
      )}
      {serverStates.some((s) => s.status === "error") && (
        <Box marginBottom={1}>
          {serverStates.filter((s) => s.status === "error").map((s) => (
            <Text key={s.config.name} color="red">  ⚠ {s.config.name}: {s.error}</Text>
          ))}
        </Box>
      )}
      <Box>
        <Text dimColor>
          <Text color="cyan">t</Text> 启用/禁用 | <Text color="cyan">o</Text> 编辑JSON |{" "}
          <Text color="cyan">r</Text> 重连
        </Text>
      </Box>
    </Box>
  );
};

export default McpManager;
