import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import configBus, { type ModelConfig } from "@/utils/config-bus.ts";

interface Props {
  onSelect: (model: ModelConfig) => void;
  onCancel?: () => void;
  onAddModel?: () => void;
  onEditModel?: (model: ModelConfig) => void;
  onDeleteModel?: (model: ModelConfig) => void;
}

/**
 * 模型选择组件
 * 使用 ink-select-input 实现交互式模型选择
 * 支持快捷键：a 添加、e 编辑、d 删除
 */
const ModelSelector: React.FC<Props> = ({
  onSelect,
  onCancel,
  onAddModel,
  onEditModel,
  onDeleteModel,
}) => {
  const models = configBus.getModels();
  const currentId = configBus.getCurrentModelId();

  // 追踪当前高亮的模型索引
  const initialIndex = Math.max(
    0,
    models.findIndex((m) => m.id === currentId)
  );
  const [highlightedIndex, setHighlightedIndex] = useState(initialIndex);

  // 监听键盘输入
  useInput((input, key) => {
    // Esc 退出
    if (key.escape && onCancel) {
      onCancel();
      return;
    }

    // a 添加模型
    if (input.toLowerCase() === "a" && onAddModel) {
      onAddModel();
      return;
    }

    // e 编辑当前高亮的模型
    if (input.toLowerCase() === "e" && onEditModel) {
      const model = models[highlightedIndex];
      if (model) {
        onEditModel(model);
      }
      return;
    }

    // d 删除当前高亮的模型
    if (input.toLowerCase() === "d" && onDeleteModel) {
      const model = models[highlightedIndex];
      if (model) {
        onDeleteModel(model);
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

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>
        🔧 选择模型 (↑↓ 移动, Enter 确认, Esc 取消)
      </Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          initialIndex={initialIndex}
          onSelect={handleSelect}
          onHighlight={handleHighlight}
        />
      </Box>
      {/* 快捷键提示 */}
      <Box marginTop={1}>
        <Text color="gray">
          <Text color="cyan">a</Text> 添加 | <Text color="cyan">e</Text> 编辑 | <Text color="cyan">d</Text> 删除
        </Text>
      </Box>
    </Box>
  );
};

export default ModelSelector;
