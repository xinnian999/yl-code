import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { Agent } from "@/core/agent/Agent.ts";
import type { ModelConfig } from "@/core/types.ts";
import ConfirmDialog from "./ConfirmDialog.tsx";
import { clampSelectedIndex } from "./list-helpers.ts";
import ModelForm, { type ModelFormData } from "./ModelForm.tsx";
import ModelListView from "./ModelListView.tsx";
import {
  buildCopiedModelFormData,
  buildModelFormData,
  buildModelLabel,
} from "./model-panel-helpers.ts";
import { useModelPanelShortcuts } from "./useModelPanelShortcuts.ts";

/** 模型面板内部视图状态 */
type ModelPanelViewState = "list" | "add" | "edit" | "delete" | "copy";

/** 模型面板属性 */
export interface ModelPanelProps {
  /** Agent 实例 */
  agent: Agent;
  /** 模型选择回调 */
  onSelect: (model: ModelConfig) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/** 模型面板 */
const ModelPanel: React.FC<ModelPanelProps> = ({ agent, onSelect, onCancel }) => {
  const [viewState, setViewState] = useState<ModelPanelViewState>("list");
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [deletingModel, setDeletingModel] = useState<ModelConfig | null>(null);
  const [copyingModel, setCopyingModel] = useState<ModelConfig | null>(null);

  const models = agent.getModels();
  const currentId = agent.getCurrentModelId();
  const initialIndex = Math.max(
    0,
    models.findIndex((model) => model.id === currentId),
  );
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  const selectedModel = models[selectedIndex];
  const isBuiltinSelected = Boolean(selectedModel?.builtin);

  /** 当前列表项 */
  const items = useMemo(() => {
    return models.map((model) => ({
      id: model.id,
      label: buildModelLabel(model, currentId),
    }));
  }, [currentId, models]);

  useEffect(() => {
    setSelectedIndex((currentIndex) => {
      return clampSelectedIndex(currentIndex, models.length);
    });
  }, [models.length]);

  useModelPanelShortcuts({
    agent,
    viewState,
    models,
    currentId,
    selectedIndex,
    selectedModel: selectedModel || null,
    setSelectedIndex,
    setViewState,
    setEditingModel,
    setCopyingModel,
    setDeletingModel,
    onSelect,
    onCancel,
  });

  /** 处理表单提交 */
  const handleFormSubmit = useCallback(
    (data: ModelFormData) => {
      if (viewState === "add" || viewState === "copy") {
        agent.addModel(data);
        setCopyingModel(null);
        onCancel?.();
        return;
      }

      if (viewState === "edit" && editingModel) {
        agent.updateModel(editingModel.id, data);
        setEditingModel(null);
        setViewState("list");
      }
    },
    [agent, editingModel, onCancel, viewState],
  );

  /** 取消表单 */
  const handleFormCancel = useCallback(() => {
    setEditingModel(null);
    setCopyingModel(null);
    setViewState("list");
  }, []);

  /** 确认删除模型 */
  const handleDeleteConfirm = useCallback(() => {
    if (!deletingModel) {
      return;
    }

    agent.removeModel(deletingModel.id);
    setDeletingModel(null);
    onCancel?.();
  }, [agent, deletingModel, onCancel]);

  /** 取消删除模型 */
  const handleDeleteCancel = useCallback(() => {
    setDeletingModel(null);
    setViewState("list");
  }, []);

  if (viewState === "add") {
    return (
      <ModelForm
        mode="add"
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
      />
    );
  }

  if (viewState === "copy" && copyingModel) {
    return (
      <ModelForm
        mode="add"
        initialValues={buildCopiedModelFormData(copyingModel)}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
      />
    );
  }

  if (viewState === "edit" && editingModel) {
    return (
      <ModelForm
        mode="edit"
        initialValues={buildModelFormData(editingModel)}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
      />
    );
  }

  if (viewState === "delete" && deletingModel) {
    return (
      <ConfirmDialog
        message={`确认删除模型 "${deletingModel.name}"？`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    );
  }

  return (
    <ModelListView
      items={items}
      selectedIndex={selectedIndex}
      isBuiltinSelected={isBuiltinSelected}
    />
  );
};

export default ModelPanel;
