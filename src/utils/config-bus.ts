import { EventEmitter } from "events";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import "dotenv/config";

// ============ 类型定义 ============

export interface ModelConfig {
  id: string;
  name: string;
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

export interface AppConfig {
  currentModel: string;
  models: ModelConfig[];
  // 未来扩展
  // theme: 'light' | 'dark';
  // language: 'zh' | 'en';
}

// ============ 事件类型 ============

interface ConfigBusEvents {
  "config:loaded": (config: AppConfig) => void;
  "config:change": (config: AppConfig) => void;
  "model:change": (model: ModelConfig) => void;
  // 未来扩展
  // "theme:change": (theme: string) => void;
}

// ============ 配置总线类 ============

class ConfigBus extends EventEmitter {
  private configDir: string;
  private configPath: string;
  private config: AppConfig;

  constructor() {
    super();
    this.configDir = join(homedir(), ".niu-code");
    this.configPath = join(this.configDir, "config.json");

    // 确保目录存在
    if (!existsSync(this.configDir)) {
      mkdirSync(this.configDir, { recursive: true });
    }

    // 加载或初始化配置
    this.config = this.loadConfig();
  }

  /**
   * 加载配置文件，如果不存在则从环境变量迁移创建默认配置
   */
  private loadConfig(): AppConfig {
    if (existsSync(this.configPath)) {
      try {
        const data = readFileSync(this.configPath, "utf-8");
        return JSON.parse(data);
      } catch (error) {
        console.error("配置文件解析失败，将使用默认配置");
      }
    }

    // 首次运行：从环境变量迁移
    const defaultConfig: AppConfig = {
      currentModel: "default",
      models: [
        {
          id: "default",
          name: process.env.NIUMA_MODEL_NAME || "Default Model",
          apiKey: process.env.NIUMA_API_KEY || "",
          baseUrl: process.env.NIUMA_BASE_URL || "",
          modelName: process.env.NIUMA_MODEL_NAME || "",
        },
      ],
    };

    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  /**
   * 保存配置到文件
   */
  private saveConfig(config: AppConfig): void {
    writeFileSync(this.configPath, JSON.stringify(config, null, 2));
  }

  // ============ 模型相关方法 ============

  /**
   * 获取所有模型配置
   */
  getModels(): ModelConfig[] {
    return [...this.config.models];
  }

  /**
   * 获取当前模型 ID
   */
  getCurrentModelId(): string {
    return this.config.currentModel;
  }

  /**
   * 获取当前模型配置
   */
  getCurrentModel(): ModelConfig {
    const model = this.config.models.find(
      (m) => m.id === this.config.currentModel
    );
    if (!model) {
      // 如果当前模型不存在，返回第一个模型
      if (this.config.models.length > 0) {
        return this.config.models[0];
      }
      throw new Error(`Model ${this.config.currentModel} not found`);
    }
    return model;
  }

  /**
   * 设置当前模型
   */
  setCurrentModel(modelId: string): void {
    const model = this.config.models.find((m) => m.id === modelId);
    if (!model) {
      throw new Error(`Model ${modelId} not found`);
    }

    this.config.currentModel = modelId;
    this.saveConfig(this.config);

    this.emit("model:change", model);
    this.emit("config:change", this.config);
  }

  /**
   * 添加新模型
   */
  addModel(model: ModelConfig): void {
    if (this.config.models.some((m) => m.id === model.id)) {
      throw new Error(`Model ${model.id} already exists`);
    }
    this.config.models.push(model);
    this.saveConfig(this.config);
    this.emit("config:change", this.config);
  }

  /**
   * 删除模型
   */
  removeModel(modelId: string): void {
    if (modelId === this.config.currentModel) {
      throw new Error("Cannot remove current model");
    }
    this.config.models = this.config.models.filter((m) => m.id !== modelId);
    this.saveConfig(this.config);
    this.emit("config:change", this.config);
  }

  /**
   * 更新模型配置
   */
  updateModel(modelId: string, updates: Partial<ModelConfig>): void {
    const index = this.config.models.findIndex((m) => m.id === modelId);
    if (index === -1) {
      throw new Error(`Model ${modelId} not found`);
    }
    this.config.models[index] = { ...this.config.models[index], ...updates };
    this.saveConfig(this.config);
    
    // 如果更新的是当前模型，触发模型变更事件
    if (modelId === this.config.currentModel) {
      this.emit("model:change", this.config.models[index]);
    }
    this.emit("config:change", this.config);
  }

  /**
   * 获取配置文件路径
   */
  getConfigPath(): string {
    return this.configPath;
  }

  // ============ 类型安全的事件方法 ============

  on<K extends keyof ConfigBusEvents>(
    event: K,
    listener: ConfigBusEvents[K]
  ): this {
    return super.on(event, listener);
  }

  off<K extends keyof ConfigBusEvents>(
    event: K,
    listener: ConfigBusEvents[K]
  ): this {
    return super.off(event, listener);
  }

  emit<K extends keyof ConfigBusEvents>(
    event: K,
    ...args: Parameters<ConfigBusEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}

// 导出单例
const configBus = new ConfigBus();
export default configBus;
