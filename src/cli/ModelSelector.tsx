import React from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import configBus, { type ModelConfig } from "@/utils/config-bus.ts";

interface Props {
  onSelect: (model: ModelConfig) => void;
}

/**
 * 模型选择组件
 * 使用 ink-select-input 实现交互式模型选择
 */
const ModelSelector: React.FC<Props> = ({ onSelect }) => {
  const models = configBus.getModels();
  const currentId = configBus.getCurrentModelId();

  // 构建选项列表，当前模型显示 ✓ 标记
  const items = models.map((model) => ({
    label: model.id === currentId ? `${model.name} ✓` : model.name,
    value: model.id,
  }));

  // 找到当前模型的索引作为初始选中项
  const initialIndex = Math.max(
    0,
    models.findIndex((m) => m.id === currentId)
  );

  const handleSelect = (item: { label: string; value: string }) => {
    const model = models.find((m) => m.id === item.value);
    if (model) {
      onSelect(model);
    }
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>
        🔧 选择模型 (↑↓/jk 移动, Enter 确认):
      </Text>
      <Box marginTop={1}>
        <SelectInput
          items={items}
          initialIndex={initialIndex}
          onSelect={handleSelect}
        />
      </Box>
    </Box>
  );
};

export default ModelSelector;
