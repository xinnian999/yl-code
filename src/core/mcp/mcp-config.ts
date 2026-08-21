/**
 * MCP 服务器配置管理 - CRUD 操作与文件持久化
 * 配置格式兼容 Claude Desktop 标准格式
 */
import { EventEmitter } from "events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { MCP_CONFIG_FILE, YL_CONFIG_DIR } from "../config/storage-config.ts";

// ============ 类型定义 ============

/** MCP 服务器传输方式 */
export type McpTransport = "stdio" | "sse";

/** MCP 服务器配置项（JSON 文件中 mcpServers 的值部分） */
export interface McpServerEntry {
  /** 传输方式（可选，不填则自动推导） */
  type?: McpTransport;
  /** stdio 模式的命令 */
  command?: string;
  /** stdio 模式的命令参数 */
  args?: string[];
  /** stdio 模式的环境变量 */
  env?: Record<string, string>;
  /** sse 模式的 URL */
  url?: string;
  /** sse 模式的 URL（baseUrl 别名，兼容 Trae 等工具） */
  baseUrl?: string;
  /** sse 模式的请求头（用于认证等） */
  headers?: Record<string, string>;
  /** 是否禁用（true 则跳过连接） */
  disabled?: boolean;
  /** 允许额外字段（description、name、isActive 等） */
  [key: string]: unknown;
}

/** MCP 服务器配置（运行时，包含从 key 提取的名称） */
export interface McpServerConfig extends McpServerEntry {
  /** 服务器名称（配置文件中的 key） */
  name: string;
}

/** MCP 配置文件结构（兼容 Claude Desktop 标准格式） */
export interface McpConfig {
  /** 服务器配置映射，key 为服务器名称 */
  mcpServers: Record<string, McpServerEntry>;
}

/** 根据配置字段推导服务器的传输方式 */
export function getTransport(server: McpServerEntry): McpTransport {
  if (server.type) return server.type;
  return (server.url || server.baseUrl) ? "sse" : "stdio";
}

/** 获取 SSE 模式的实际 URL（兼容 url 和 baseUrl） */
export function getServerUrl(server: McpServerEntry): string | undefined {
  return server.url || server.baseUrl;
}

// ============ 事件类型 ============

/** MCP 配置管理器事件定义 */
interface McpConfigEvents {
  "mcp:config-change": () => void;
}

// ============ 配置管理器 ============

/**
 * MCP 配置管理器 - 服务器配置的 CRUD、文件持久化、变更通知
 */
export class McpConfigManager extends EventEmitter {
  /** 配置文件路径 */
  private configPath: string;
  /** 当前配置 */
  private config: McpConfig;

  constructor() {
    super();
    this.configPath = MCP_CONFIG_FILE;

    if (!existsSync(YL_CONFIG_DIR)) {
      mkdirSync(YL_CONFIG_DIR, { recursive: true });
    }

    this.config = this.loadConfig();
  }

  /** 从文件加载配置，失败则返回默认配置 */
  private loadConfig(): McpConfig {
    if (existsSync(this.configPath)) {
      try {
        const data = readFileSync(this.configPath, "utf-8");
        const parsed = JSON.parse(data);
        if (parsed.mcpServers && typeof parsed.mcpServers === "object") {
          return { mcpServers: parsed.mcpServers };
        }
      } catch {
        // 配置文件损坏，返回默认
      }
    }
    return { mcpServers: {} };
  }

  /** 将配置持久化到文件 */
  private saveConfig(): void {
    writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
  }

  /** 获取所有服务器配置 */
  getServers(): McpServerConfig[] {
    return Object.entries(this.config.mcpServers).map(([name, entry]) => ({
      name,
      ...entry,
    }));
  }

  /** 获取已启用的服务器配置（过滤 disabled: true） */
  getEnabledServers(): McpServerConfig[] {
    return this.getServers().filter((s) => !s.disabled);
  }

  /** 添加服务器配置 */
  addServer(name: string, entry: McpServerEntry): void {
    this.config.mcpServers[name] = entry;
    this.saveConfig();
    this.emit("mcp:config-change");
  }

  /** 更新服务器配置 */
  updateServer(name: string, entry: McpServerEntry): void {
    if (!(name in this.config.mcpServers)) {
      throw new Error(`MCP server "${name}" not found`);
    }
    this.config.mcpServers[name] = entry;
    this.saveConfig();
    this.emit("mcp:config-change");
  }

  /** 重命名服务器并更新配置 */
  renameServer(oldName: string, newName: string, entry: McpServerEntry): void {
    delete this.config.mcpServers[oldName];
    this.config.mcpServers[newName] = entry;
    this.saveConfig();
    this.emit("mcp:config-change");
  }

  /** 删除服务器配置 */
  removeServer(name: string): void {
    delete this.config.mcpServers[name];
    this.saveConfig();
    this.emit("mcp:config-change");
  }

  /** 切换服务器的禁用状态 */
  toggleServer(name: string): void {
    const entry = this.config.mcpServers[name];
    if (!entry) return;
    if (entry.disabled) {
      delete entry.disabled;
    } else {
      entry.disabled = true;
    }
    this.saveConfig();
    this.emit("mcp:config-change");
  }

  /** 从磁盘重新加载配置（用于外部编辑后刷新） */
  reload(): void {
    this.config = this.loadConfig();
    this.emit("mcp:config-change");
  }

  /** 确保配置文件存在（不存在则创建默认） */
  ensureConfigFile(): void {
    if (!existsSync(this.configPath)) {
      this.saveConfig();
    }
  }

  /** 获取配置文件路径 */
  getConfigPath(): string {
    return this.configPath;
  }

  // 类型安全的事件方法
  on<K extends keyof McpConfigEvents>(event: K, listener: McpConfigEvents[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof McpConfigEvents>(event: K, listener: McpConfigEvents[K]): this {
    return super.off(event, listener);
  }

  emit<K extends keyof McpConfigEvents>(event: K, ...args: Parameters<McpConfigEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
