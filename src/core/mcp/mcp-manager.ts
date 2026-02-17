/**
 * MCP 连接管理器 - 管理 MultiServerMCPClient 生命周期、工具加载和状态追踪
 */
import { EventEmitter } from "events";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { getTransport, getServerUrl } from "./mcp-config.ts";
import type { McpConfigManager, McpServerConfig } from "./mcp-config.ts";

// ============ 类型定义 ============

/** 服务器连接状态 */
export type McpServerStatus = "disconnected" | "connecting" | "connected" | "error";

/** 服务器运行时状态 */
export interface McpServerState {
  /** 服务器配置 */
  config: McpServerConfig;
  /** 连接状态 */
  status: McpServerStatus;
  /** 加载到的工具数量 */
  toolCount: number;
  /** 错误信息（仅 error 状态） */
  error?: string;
}

/** MCP 管理器事件定义 */
interface McpManagerEvents {
  "mcp:status-change": (states: McpServerState[]) => void;
}

// ============ 常量 ============

/** 单个服务器连接超时时间（毫秒） */
const CONNECTION_TIMEOUT_MS = 30_000;

// ============ 管理器 ============

/**
 * MCP 管理器 - 包装 MultiServerMCPClient，提供懒初始化、状态追踪和重连能力
 */
export class McpManager extends EventEmitter {
  /** MCP 配置管理器引用 */
  private mcpConfig: McpConfigManager;
  /** 当前客户端实例 */
  private client: MultiServerMCPClient | null = null;
  /** 缓存的 MCP 工具 */
  private cachedTools: DynamicStructuredTool[] = [];
  /** 各服务器运行时状态 */
  private serverStates: Map<string, McpServerState> = new Map();
  /** 是否已初始化 */
  private initialized = false;

  constructor(mcpConfig: McpConfigManager) {
    super();
    this.mcpConfig = mcpConfig;
  }

  /** 是否已完成初始化 */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** 构建 MultiServerMCPClient 所需的 mcpServers 配置 */
  private buildClientConfig(): Record<string, any> {
    const servers = this.mcpConfig.getEnabledServers();
    const mcpServers: Record<string, any> = {};

    for (const server of servers) {
      const transport = getTransport(server);
      if (transport === "stdio" && server.command) {
        mcpServers[server.name] = {
          transport: "stdio",
          command: server.command,
          args: server.args || [],
        };
      } else if (transport === "sse") {
        const url = getServerUrl(server);
        if (!url) continue;
        const config: Record<string, any> = { transport: "sse", url };
        if (server.headers) config.headers = server.headers;
        mcpServers[server.name] = config;
      }
    }

    return mcpServers;
  }

  /** 设置单个服务器状态 */
  private setState(server: McpServerConfig, status: McpServerStatus, toolCount = 0, error?: string): void {
    this.serverStates.set(server.name, { config: server, status, toolCount, error });
  }

  /** 初始化连接并加载工具（幂等，已初始化则跳过） */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const enabledServers = this.mcpConfig.getEnabledServers();
    if (enabledServers.length === 0) { this.initialized = true; return; }

    for (const server of enabledServers) this.setState(server, "connecting");
    this.emitStatusChange();

    const mcpServers = this.buildClientConfig();
    if (Object.keys(mcpServers).length === 0) { this.initialized = true; return; }

    const serverErrors = new Map<string, string>();
    this.client = new MultiServerMCPClient({
      mcpServers,
      prefixToolNameWithServerName: true,
      onConnectionError: ({ serverName, error }) => {
        serverErrors.set(serverName, (error as Error)?.message || String(error));
      },
    });

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("连接超时（30s）")), CONNECTION_TIMEOUT_MS);
      });
      const toolsPerServer = await Promise.race([
        this.client.initializeConnections(),
        timeoutPromise,
      ]);
      this.cachedTools = Object.values(toolsPerServer).flat();

      for (const server of enabledServers) {
        const error = serverErrors.get(server.name);
        if (error) { this.setState(server, "error", 0, error); }
        else { this.setState(server, "connected", toolsPerServer[server.name]?.length || 0); }
      }
    } catch (error) {
      const errMsg = (error as Error)?.message || String(error);
      for (const server of enabledServers) this.setState(server, "error", 0, errMsg);
    }

    this.initialized = true;
    this.emitStatusChange();
  }

  /** 获取缓存的 MCP 工具列表 */
  getTools(): DynamicStructuredTool[] {
    return this.cachedTools;
  }

  /** 获取各服务器当前状态 */
  getServerStates(): McpServerState[] {
    // 包含未启用的服务器（状态为 disconnected）
    const allServers = this.mcpConfig.getServers();
    return allServers.map((server) => {
      const state = this.serverStates.get(server.name);
      if (state) return state;
      return { config: server, status: "disconnected" as McpServerStatus, toolCount: 0 };
    });
  }

  /** 关闭当前连接并重新初始化 */
  async reconnect(): Promise<void> {
    await this.close();
    this.initialized = false;
    this.serverStates.clear();
    this.cachedTools = [];
    await this.initialize();
  }

  /** 关闭所有连接并清理资源 */
  async close(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
      } catch {
        // 忽略关闭错误
      }
      this.client = null;
    }
  }

  /** 发送状态变更事件 */
  private emitStatusChange(): void {
    this.emit("mcp:status-change", this.getServerStates());
  }

  // 类型安全的事件方法
  on<K extends keyof McpManagerEvents>(event: K, listener: McpManagerEvents[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof McpManagerEvents>(event: K, listener: McpManagerEvents[K]): this {
    return super.off(event, listener);
  }

  emit<K extends keyof McpManagerEvents>(event: K, ...args: Parameters<McpManagerEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
