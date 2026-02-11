import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import configBus, { type ModelConfig } from "@/utils/config-bus.ts";
import ModelForm, { type ModelFormData } from "./ModelForm.tsx";
import ConfirmDialog from "./ConfirmDialog.tsx";
import messageBus from "@/utils/message-bus.ts";

// 内部视图状态
type ViewState = "list" | "add" | "edit" | "delete" | "copy";

interface Props {
  onSelect: (model: ModelConfig) => void;
  onCancel?: () => void;
}

/**
 * 模型选择组件
 * 使用 ink-select-input 实现交互式模型选择
 * 内部管理添加、编辑、删除模型的表单状态
 * 支持快捷键：a 添加、c 复制、e 编辑、d 删除
 */
const ModelSelector: React.FC<Props> = ({ onSelect, onCancel }) => {
  const [viewState, setViewState] = useState<ViewState>("list");
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [deletingModel, setDeletingModel] = useState<ModelConfig | null>(null);
  const [copyingModel, setCopyingModel] = useState<ModelConfig | null>(null);

  // 使用函数获取最新的 models，确保更新后能获取到最新数据
  const getModels = () => configBus.getModels();
  const currentId = configBus.getCurrentModelId();
  const models = getModels();

  // 追踪当前高亮的模型索引
  const initialIndex = Math.max(
    0,
    models.findIndex((m) => m.id === currentId)
  );
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);

  // 监听键盘输入（仅在列表视图时生效）
  useInput((input, key) => {
    if (viewState !== "list") return;

    // Esc 退出
    if (key.escape && onCancel) {
      onCancel();
      return;
    }

    // a 添加模型
    if (input.toLowerCase() === "a") {
      setViewState("add");
      return;
    }

    // c 复制当前高亮的模型
    if (input.toLowerCase() === "c") {
      const model = models[highlightedIndex];
      if (model) {
        setCopyingModel(model);
        setViewState("copy");
      }
      return;
    }

    // e 编辑当前高亮的模型
    if (input.toLowerCase() === "e") {
      const model = models[highlightedIndex];
      if (model) {
        setEditingModel(model);
        setViewState("edit");
      }
      return;
    }

    // d 删除当前高亮的模型
    if (input.toLowerCase() === "d") {
      const model = models[highlightedIndex];
      if (model) {
        // 不能删除当前正在使用的模型
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

  // 构建选项列表，当前模型显示 ✓ 标记
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

  // 模型表单提交回调
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
        configBus.addModel(newModel);
        configBus.setCurrentModel(newModel.id);
        messageBus.createAIMessage();
        messageBus.ai(`✅ 模型 "${data.name}" 添加成功，已自动切换`);
        setCopyingModel(null);
        onCancel?.();
      } else if (viewState === "edit" && editingModel) {
        configBus.updateModel(editingModel.id, {
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
    [viewState, editingModel, onCancel]
  );

  // 模型表单取消回调
  const handleFormCancel = useCallback(() => {
    setEditingModel(null);
    setCopyingModel(null);
    setViewState("list");
  }, []);

  // 删除确认回调
  const handleDeleteConfirm = useCallback(() => {
    if (deletingModel) {
      configBus.removeModel(deletingModel.id);
      messageBus.createAIMessage();
      messageBus.ai(`✅ 模型 "${deletingModel.name}" 已删除`);
      setDeletingModel(null);
      onCancel?.();
    }
  }, [deletingModel, onCancel]);

  // 删除取消回调
  const handleDeleteCancel = useCallback(() => {
    setDeletingModel(null);
    setViewState("list");
  }, []);

  // 根据当前视图状态渲染不同内容
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

  // 默认显示模型列表
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
      {/* 快捷键提示 */}
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
