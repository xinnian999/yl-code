import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { ScrollList } from "ink-scroll-list";
import type { Agent } from "@/core/agent.ts";
import type { ModelConfig } from "@/core/types.ts";
import ModelForm, { type ModelFormData } from "./ModelForm.tsx";
import ConfirmDialog from "./ConfirmDialog.tsx";

/** 内部视图状态 */
type ViewState = "list" | "add" | "edit" | "delete" | "copy";

/** 模型选择组件属性 */
interface Props {
  agent: Agent;
  onSelect: (model: ModelConfig) => void;
  onCancel?: () => void;
}

/** 可滚动列表的最大可见高度 */
const LIST_HEIGHT = 12;

/**
 * 模型选择组件
 * 使用 ink-scroll-list 实现交互式模型选择
 * 内部管理添加、编辑、删除模型的表单状态
 * 支持快捷键：a 添加、c 复制、e 编辑、d 删除
 */
const ModelSelector: React.FC<Props> = ({ agent, onSelect, onCancel }) => {
  const [viewState, setViewState] = useState<ViewState>("list");
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [deletingModel, setDeletingModel] = useState<ModelConfig | null>(null);
  const [copyingModel, setCopyingModel] = useState<ModelConfig | null>(null);

  const models = agent.getModels();
  const currentId = agent.getCurrentModelId();

  const initialIndex = Math.max(0, models.findIndex((m) => m.id === currentId));
  const [selectedIndex, setSelectedIndex] = useState(initialIndex);

  useInput((input, key) => {
    if (viewState !== "list") return;

    if (key.escape && onCancel) {
      onCancel();
      return;
    }

    // 上下键导航
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, models.length - 1));
      return;
    }

    // Enter 确认选中
    if (key.return) {
      const model = models[selectedIndex];
      if (model) onSelect(model);
      return;
    }

    if (input.toLowerCase() === "a") {
      setViewState("add");
      return;
    }

    // 内置模型不支持 c/e/d 操作
    const selected = models[selectedIndex];
    if (selected?.free) return;

    if (input.toLowerCase() === "c") {
      if (selected) {
        setCopyingModel(selected);
        setViewState("copy");
      }
      return;
    }

    if (input.toLowerCase() === "e") {
      if (selected) {
        setEditingModel(selected);
        setViewState("edit");
      }
      return;
    }

    if (input.toLowerCase() === "d") {
      if (!selected) return;
      if (selected.id === currentId) {
        agent.notify("⚠️ 不能删除当前正在使用的模型，请先切换到其他模型");
        onCancel?.();
        return;
      }
      setDeletingModel(selected);
      setViewState("delete");
      return;
    }
  });

  /** 表单提交处理 */
  const handleFormSubmit = useCallback(
    (data: ModelFormData) => {
      if (viewState === "add" || viewState === "copy") {
        agent.addModel(data);
        setCopyingModel(null);
        onCancel?.();
      } else if (viewState === "edit" && editingModel) {
        agent.updateModel(editingModel.id, data);
        setEditingModel(null);
        setViewState("list");
      }
    },
    [viewState, editingModel, onCancel, agent]
  );

  /** 表单取消处理 */
  const handleFormCancel = useCallback(() => {
    setEditingModel(null);
    setCopyingModel(null);
    setViewState("list");
  }, []);

  /** 确认删除模型 */
  const handleDeleteConfirm = useCallback(() => {
    if (deletingModel) {
      agent.removeModel(deletingModel.id);
      setDeletingModel(null);
      onCancel?.();
    }
  }, [deletingModel, onCancel, agent]);

  /** 取消删除 */
  const handleDeleteCancel = useCallback(() => {
    setDeletingModel(null);
    setViewState("list");
  }, []);

  if (viewState === "add") {
    return <ModelForm mode="add" onSubmit={handleFormSubmit} onCancel={handleFormCancel} />;
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

  const isFreeSelected = models[selectedIndex]?.free;

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
        marginTop={1}
        marginBottom={1}
        height={LIST_HEIGHT}
      >
        <ScrollList selectedIndex={selectedIndex}>
          {models.map((model, i) => {
            const isCurrent = model.id === currentId;
            const label = model.free ? `[免费] ${model.name}` : model.name;
            const suffix = isCurrent ? " ✓" : "";
            return (
              <Box key={model.id} paddingX={1}>
                <Text color={i === selectedIndex ? "green" : ""}>
                  {i === selectedIndex ? "> " : "  "}
                  {label}{suffix}
                </Text>
              </Box>
            );
          })}
        </ScrollList>
      </Box>
      <Box>
        <Text color="gray">
          <Text color="cyan">a</Text> 添加
          {!isFreeSelected && (
            <>
              {" | "}<Text color="cyan">c</Text> 复制
              {" | "}<Text color="cyan">e</Text> 编辑
              {" | "}<Text color="cyan">d</Text> 删除
            </>
          )}
        </Text>
      </Box>
    </Box>
  );
};

export default ModelSelector;
