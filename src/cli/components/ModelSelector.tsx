import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import type { ConfigManager, ModelConfig } from "@/core/config.ts";
import type { MessageBus } from "@/core/message-bus.ts";
import ModelForm, { type ModelFormData } from "./ModelForm.tsx";
import ConfirmDialog from "./ConfirmDialog.tsx";

/** 内部视图状态 */
type ViewState = "list" | "add" | "edit" | "delete" | "copy";

/** 模型选择组件属性 */
interface Props {
  configManager: ConfigManager;
  messageBus: MessageBus;
  onSelect: (model: ModelConfig) => void;
  onCancel?: () => void;
}

/**
 * 模型选择组件
 * 使用 ink-select-input 实现交互式模型选择
 * 内部管理添加、编辑、删除模型的表单状态
 * 支持快捷键：a 添加、c 复制、e 编辑、d 删除
 */
const ModelSelector: React.FC<Props> = ({ configManager, messageBus, onSelect, onCancel }) => {
  const [viewState, setViewState] = useState<ViewState>("list");
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [deletingModel, setDeletingModel] = useState<ModelConfig | null>(null);
  const [copyingModel, setCopyingModel] = useState<ModelConfig | null>(null);

  const getModels = () => configManager.getModels();
  const currentId = configManager.getCurrentModelId();
  const models = getModels();

  const initialIndex = Math.max(
    0,
    models.findIndex((m) => m.id === currentId)
  );
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);

  useInput((input, key) => {
    if (viewState !== "list") return;

    if (key.escape && onCancel) {
      onCancel();
      return;
    }

    if (input.toLowerCase() === "a") {
      setViewState("add");
      return;
    }

    if (input.toLowerCase() === "c") {
      const model = models[highlightedIndex];
      if (model) {
        setCopyingModel(model);
        setViewState("copy");
      }
      return;
    }

    if (input.toLowerCase() === "e") {
      const model = models[highlightedIndex];
      if (model) {
        setEditingModel(model);
        setViewState("edit");
      }
      return;
    }

    if (input.toLowerCase() === "d") {
      const model = models[highlightedIndex];
      if (model) {
        if (model.id === currentId) {
          messageBus.createAIMessage();
          messageBus.ai("⚠️ 不能删除当前正在使用的模型，请先切换到其他模型");
          onCancel?.();
          return;
        }
        setDeletingModel(model);
        setViewState("delete");
      }
      return;
    }
  });

  const items = models.map((model) => ({
    label: model.id === currentId ? `${model.name} ✓` : model.name,
    value: model.id,
  }));

  const handleSelect = (item: { label: string; value: string }) => {
    const model = models.find((m) => m.id === item.value);
    if (model) {
      onSelect(model);
    }
  };

  const handleHighlight = (item: { label: string; value: string }) => {
    const index = models.findIndex((m) => m.id === item.value);
    if (index !== -1) {
      setHighlightedIndex(index);
    }
  };

  const handleFormSubmit = useCallback(
    (data: ModelFormData) => {
      if (viewState === "add" || viewState === "copy") {
        const newModel: ModelConfig = {
          id: `model_${Date.now()}`,
          name: data.name,
          baseUrl: data.baseUrl,
          apiKey: data.apiKey,
          modelName: data.modelName,
        };
        configManager.addModel(newModel);
        configManager.setCurrentModel(newModel.id);
        messageBus.createAIMessage();
        messageBus.ai(`✅ 模型 "${data.name}" 添加成功，已自动切换`);
        setCopyingModel(null);
        onCancel?.();
      } else if (viewState === "edit" && editingModel) {
        configManager.updateModel(editingModel.id, {
          name: data.name,
          baseUrl: data.baseUrl,
          apiKey: data.apiKey,
          modelName: data.modelName,
        });
        messageBus.createAIMessage();
        messageBus.ai(`✅ 模型 "${data.name}" 更新成功`);
        setEditingModel(null);
        setViewState("list");
      }
    },
    [viewState, editingModel, onCancel, configManager, messageBus]
  );

  const handleFormCancel = useCallback(() => {
    setEditingModel(null);
    setCopyingModel(null);
    setViewState("list");
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (deletingModel) {
      configManager.removeModel(deletingModel.id);
      messageBus.createAIMessage();
      messageBus.ai(`✅ 模型 "${deletingModel.name}" 已删除`);
      setDeletingModel(null);
      onCancel?.();
    }
  }, [deletingModel, onCancel, configManager, messageBus]);

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
        initialValues={{
          name: `${copyingModel.name} (复制)`,
          baseUrl: copyingModel.baseUrl,
          apiKey: copyingModel.apiKey,
          modelName: "",
        }}
        onSubmit={handleFormSubmit}
        onCancel={handleFormCancel}
      />
    );
  }

  if (viewState === "edit" && editingModel) {
    return (
      <ModelForm
        mode="edit"
        initialValues={{
          name: editingModel.name,
          baseUrl: editingModel.baseUrl,
          apiKey: editingModel.apiKey,
          modelName: editingModel.modelName,
        }}
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
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>
        🔧 选择模型 (↑↓ 移动, Enter 确认, Esc 取消)
      </Text>
      <Box
        borderStyle="single"
        borderTop
        borderBottom
        borderLeft={false}
        borderRight={false}
        padding={1}
        marginTop={1}
        marginBottom={1}
      >
        <SelectInput
          items={items}
          initialIndex={initialIndex}
          onSelect={handleSelect}
          onHighlight={handleHighlight}
        />
      </Box>
      <Box>
        <Text color="gray">
          <Text color="cyan">a</Text> 添加 | <Text color="cyan">c</Text> 复制 |{" "}
          <Text color="cyan">e</Text> 编辑 | <Text color="cyan">d</Text> 删除
        </Text>
      </Box>
    </Box>
  );
};

export default ModelSelector;
