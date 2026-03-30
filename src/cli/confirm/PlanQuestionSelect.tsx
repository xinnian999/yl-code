import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import TextInput from "ink-text-input";
import type {
  PendingPlanQuestion,
  PlanQuestionAnswer,
} from "@/core/plan/plan-bus.ts";

/** 计划问题选择组件属性 */
export interface PlanQuestionSelectProps {
  /** 当前待回答的问题 */
  interaction: PendingPlanQuestion;
  /** 回答完成后的回调 */
  onResolve: (answer: PlanQuestionAnswer) => void;
}

/** 自定义输入选项的特殊值 */
const CUSTOM_VALUE = "__custom__";

/** 选项条目组件属性 */
interface OptionItemProps {
  /** 是否选中 */
  isSelected?: boolean;
  /** 选项标签 */
  label: string;
  /** 描述映射表 */
  descriptionMap: Map<string, string>;
}

/** 带描述的选项渲染组件 */
const OptionItem: React.FC<OptionItemProps> = ({
  isSelected,
  label,
  descriptionMap,
}) => {
  const description = descriptionMap.get(label);

  return (
    <Box flexDirection="column">
      <Text color={isSelected ? "cyan" : undefined} bold={isSelected}>
        {label}
      </Text>
      {description ? <Text dimColor>  {description}</Text> : null}
    </Box>
  );
};

/** 计划问题底部选择组件 */
const PlanQuestionSelect: React.FC<PlanQuestionSelectProps> = ({
  interaction,
  onResolve,
}) => {
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const [customValue, setCustomValue] = useState("");

  /** 构建选项的描述映射表 */
  const descriptionMap = useMemo(() => {
    const map = new Map<string, string>();
    interaction.options.forEach((option) => {
      if (option.description) {
        map.set(option.label, option.description);
      }
    });
    return map;
  }, [interaction.options]);

  /** 构建包含自定义输入的完整选项列表 */
  const items = useMemo(() => {
    return [
      ...interaction.options.map((option) => ({
        label: option.label,
        value: option.label,
        key: option.label,
      })),
      { label: "自定义输入...", value: CUSTOM_VALUE, key: CUSTOM_VALUE },
    ];
  }, [interaction.options]);

  /** 提交自定义输入内容 */
  const submitCustomValue = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) {
      return;
    }

    onResolve({
      answer: trimmedValue,
      displayText: trimmedValue,
      isCustom: true,
    });
  };

  /** 处理选项选中 */
  const handleSelect = (item: { value: string }) => {
    if (item.value === CUSTOM_VALUE) {
      setIsCustomEditing(true);
      return;
    }

    const selectedOption = interaction.options.find(
      (option) => option.label === item.value,
    );
    if (!selectedOption) {
      return;
    }

    onResolve({
      answer: `我选择：${selectedOption.label}`,
      displayText: `选择：${selectedOption.label}`,
      isCustom: false,
    });
  };

  /** 自定义输入模式下处理 Escape 返回选项列表 */
  useInput(
    (_, key) => {
      if (!key.escape) {
        return;
      }

      setIsCustomEditing(false);
      setCustomValue("");
    },
    { isActive: isCustomEditing },
  );

  if (isCustomEditing) {
    return (
      <Box flexDirection="column" paddingX={1} gap={1}>
        <Box flexDirection="column">
          <Text bold>{interaction.title}</Text>
          <Text>{interaction.question}</Text>
        </Box>
        <Text dimColor>
          请输入你的自定义回答，按 Enter 提交，Esc 返回选项列表
        </Text>
        <TextInput
          value={customValue}
          onChange={setCustomValue}
          onSubmit={submitCustomValue}
          placeholder="输入你的回答..."
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} gap={1}>
      <Box flexDirection="column">
        <Text bold>{interaction.title}</Text>
        <Text>{interaction.question}</Text>
      </Box>
      <SelectInput
        items={items}
        itemComponent={(props) => (
          <OptionItem {...props} descriptionMap={descriptionMap} />
        )}
        onSelect={handleSelect}
      />
    </Box>
  );
};

export default PlanQuestionSelect;
