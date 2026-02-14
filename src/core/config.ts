import { EventEmitter } from "events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import type { ConfigPort, ModelConfig } from "./types.ts";

export type { ModelConfig } from "./types.ts";

export interface AppConfig {
  currentModel: string;
  models: ModelConfig[];
}

// ============ 事件类型 ============

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

  private saveConfig(config: AppConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  // --- ConfigPort 接口 ---

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

  onModelChange(callback: () => void): () => void {
    this.on("model:change", callback);
    return () => this.off("model:change", callback);
  }

  // --- 完整 CRUD ---

  hasModels(): boolean {
    return this.config.models.length > 0;
  }

  getModels(): ModelConfig[] {
    return [...this.config.models];
  }

  getCurrentModelId(): string {
    return this.config.currentModel;
  }

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

  addModel(model: ModelConfig): void {
    if (this.config.models.some((m) => m.id === model.id)) {
      throw new Error(`Model ${model.id} already exists`);
    }
    this.config.models.push(model);
    this.saveConfig(this.config);
    this.emit("config:change");
  }

  removeModel(modelId: string): void {
    if (modelId === this.config.currentModel) {
      throw new Error("Cannot remove current model");
    }
    this.config.models = this.config.models.filter((m) => m.id !== modelId);
    this.saveConfig(this.config);
    this.emit("config:change");
  }

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

  isCurrentModel(modelId: string): boolean {
    return modelId === this.config.currentModel;
  }

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
