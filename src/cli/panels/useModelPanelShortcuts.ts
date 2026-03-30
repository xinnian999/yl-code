import type { Dispatch, SetStateAction } from "react";
import { useInput } from "ink";
import type { Agent } from "@/core/agent/Agent.ts";
import type { ModelConfig } from "@/core/types.ts";
import { getNextSelectedIndex } from "./list-helpers.ts";

/** 模型面板快捷键上下文 */
export interface UseModelPanelShortcutsOptions {
  /** Agent 实例 */
  agent: Agent;
  /** 当前视图状态 */
  viewState: "list" | "add" | "edit" | "delete" | "copy";
  /** 模型列表 */
  models: ModelConfig[];
  /** 当前使用的模型 ID */
  currentId: string;
  /** 当前选中索引 */
  selectedIndex: number;
  /** 当前选中的模型 */
  selectedModel: ModelConfig | null;
  /** 更新选中索引 */
  setSelectedIndex: Dispatch<SetStateAction<number>>;
  /** 更新视图状态 */
  setViewState: Dispatch<
    SetStateAction<"list" | "add" | "edit" | "delete" | "copy">
  >;
  /** 设置编辑模型 */
  setEditingModel: (model: ModelConfig) => void;
  /** 设置复制模型 */
  setCopyingModel: (model: ModelConfig) => void;
  /** 设置删除模型 */
  setDeletingModel: (model: ModelConfig) => void;
  /** 选择模型回调 */
  onSelect: (model: ModelConfig) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/** 模型面板快捷键 hook */
export function useModelPanelShortcuts(
  options: UseModelPanelShortcutsOptions,
): void {
  const {
    agent,
    viewState,
    models,
    currentId,
    selectedIndex,
    selectedModel,
    setSelectedIndex,
    setViewState,
    setEditingModel,
    setCopyingModel,
    setDeletingModel,
    onSelect,
    onCancel,
  } = options;

  useInput((input, key) => {
    if (viewState !== "list") {
      return;
    }

    if (key.escape && onCancel) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((currentIndex) => {
        return getNextSelectedIndex(currentIndex, models.length, "up");
      });
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((currentIndex) => {
        return getNextSelectedIndex(currentIndex, models.length, "down");
      });
      return;
    }

    if (key.return) {
      const model = models[selectedIndex];
      if (model) {
        onSelect(model);
      }
      return;
    }

    if (input.toLowerCase() === "a") {
      setViewState("add");
      return;
    }

    if (!selectedModel || selectedModel.builtin) {
      return;
    }

    if (input.toLowerCase() === "c") {
      setCopyingModel(selectedModel);
      setViewState("copy");
      return;
    }

    if (input.toLowerCase() === "e") {
      setEditingModel(selectedModel);
      setViewState("edit");
      return;
    }

    if (input.toLowerCase() !== "d") {
      return;
    }

    if (selectedModel.id === currentId) {
      agent.notify("⚠️ 不能删除当前正在使用的模型，请先切换到其他模型");
      onCancel?.();
      return;
    }

    setDeletingModel(selectedModel);
    setViewState("delete");
  });
}
