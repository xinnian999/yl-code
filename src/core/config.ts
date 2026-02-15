import { EventEmitter } from "events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ConfigPort, ModelConfig } from "./types.ts";

export type { ModelConfig } from "./types.ts";

/** 应用配置（持久化到文件） */
export interface AppConfig {
  currentModel: string;
  models: ModelConfig[];
}

// ============ 事件类型 ============

/** 配置管理器事件定义 */
interface ConfigManagerEvents {
  "model:change": (model: ModelConfig) => void;
  "config:change": () => void;
}

// ============ 配置管理器 ============

/**
 * 配置管理器 - 模型配置的 CRUD、文件持久化、变更通知
 */
export class ConfigManager extends EventEmitter implements ConfigPort {
  private configDir: string;
  private configPath: string;
  private config: AppConfig;

  constructor() {
    super();
    this.configDir = join(homedir(), ".niu-code");
    this.configPath = join(this.configDir, "config.json");

    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    this.config = this.loadConfig();
  }

  /** 从文件加载配置，失败则返回默认配置 */
  private loadConfig(): AppConfig {
    if (existsSync(this.configPath)) {
      try {
        const data = readFileSync(this.configPath, "utf-8");
        return JSON.parse(data);
      } catch {
        console.error("配置文件解析失败，将使用默认配置");
      }
    }

    const defaultConfig: AppConfig = {
      currentModel: "",
      models: [],
    };
    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /** 将配置持久化到文件 */
  private saveConfig(config: AppConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  // --- ConfigPort 接口 ---

  /** 获取当前激活的模型配置 */
  getCurrentModel(): ModelConfig {
    if (this.config.models.length === 0) {
      throw new Error("请先配置模型：输入 /model 然后按 a 添加");
    }

    const model = this.config.models.find(
      (m) => m.id === this.config.currentModel
    );
    if (!model) {
      if (this.config.models.length > 0) {
        return this.config.models[0];
      }
      throw new Error(`Model ${this.config.currentModel} not found`);
    }
    return model;
  }

  /** 监听模型变更事件，返回取消订阅函数 */
  onModelChange(callback: () => void): () => void {
    this.on("model:change", callback);
    return () => this.off("model:change", callback);
  }

  // --- 完整 CRUD ---

  /** 是否已配置模型 */
  hasModels(): boolean {
    return this.config.models.length > 0;
  }

  /** 获取所有模型配置的副本 */
  getModels(): ModelConfig[] {
    return [...this.config.models];
  }

  /** 获取当前模型 ID */
  getCurrentModelId(): string {
    return this.config.currentModel;
  }

  /** 切换当前模型 */
  setCurrentModel(modelId: string): void {
    const model = this.config.models.find((m) => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }
    this.config.currentModel = modelId;
    this.saveConfig(this.config);
    this.emit("model:change", model);
    this.emit("config:change");
  }

  /** 添加新模型配置 */
  addModel(model: ModelConfig): void {
    if (this.config.models.some((m) => m.id === model.id)) {
      throw new Error(`Model ${model.id} already exists`);
    }
    this.config.models.push(model);
    this.saveConfig(this.config);
    this.emit("config:change");
  }

  /** 删除模型配置（不能删除当前使用的模型） */
  removeModel(modelId: string): void {
    if (modelId === this.config.currentModel) {
      throw new Error("Cannot remove current model");
    }
    this.config.models = this.config.models.filter((m) => m.id !== modelId);
    this.saveConfig(this.config);
    this.emit("config:change");
  }

  /** 更新模型配置 */
  updateModel(modelId: string, updates: Partial<ModelConfig>): void {
    const index = this.config.models.findIndex((m) => m.id === modelId);
    if (index === -1) {
      throw new Error(`Model ${modelId} not found`);
    }
    this.config.models[index] = { ...this.config.models[index], ...updates };
    this.saveConfig(this.config);
    if (this.isCurrentModel(modelId)) {
      this.emit("model:change", this.config.models[index]);
    }
    this.emit("config:change");
  }

  /** 判断指定模型是否为当前模型 */
  isCurrentModel(modelId: string): boolean {
    return modelId === this.config.currentModel;
  }

  /** 获取配置文件路径 */
  getConfigPath(): string {
    return this.configPath;
  }

  // 类型安全的事件方法
  on<K extends keyof ConfigManagerEvents>(event: K, listener: ConfigManagerEvents[K]): this {
    return super.on(event, listener);
  }

  off<K extends keyof ConfigManagerEvents>(event: K, listener: ConfigManagerEvents[K]): this {
    return super.off(event, listener);
  }

  emit<K extends keyof ConfigManagerEvents>(event: K, ...args: Parameters<ConfigManagerEvents[K]>): boolean {
    return super.emit(event, ...args);
  }
}
