import type { ModelConfig } from "@/core/types.ts";
import type { ModelFormData } from "./ModelForm.tsx";

/** 构建模型表单初始值 */
export function buildModelFormData(model: ModelConfig): ModelFormData {
  return {
    name: model.name,
    baseUrl: model.baseUrl,
    apiKey: model.apiKey,
    modelName: model.modelName,
  };
}

/** 构建复制模型时的表单初始值 */
export function buildCopiedModelFormData(model: ModelConfig): ModelFormData {
  return {
    name: `${model.name} (复制)`,
    baseUrl: model.baseUrl,
    apiKey: model.apiKey,
    modelName: "",
  };
}

/** 构建模型列表项文案 */
export function buildModelLabel(model: ModelConfig, currentId: string): string {
  const label = model.builtin ? `[免费] ${model.name}` : model.name;
  const suffix = model.id === currentId ? " ✓" : "";

  return `${label}${suffix}`;
}
