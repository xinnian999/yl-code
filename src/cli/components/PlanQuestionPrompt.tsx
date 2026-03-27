import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type {
  PendingPlanQuestion,
  PlanQuestionAnswer,
} from "@/core/plan/plan-bus.ts";

/** 计划问题组件属性 */
interface PlanQuestionPromptProps {
  /** 当前待回答的问题 */
  interaction: PendingPlanQuestion;
  /** 回答完成后的回调 */
  onResolve: (answer: PlanQuestionAnswer) => void;
}

/** 自定义输入选项标签 */
const CUSTOM_OPTION_LABEL = "自定义输入";

/**
 * 计划问题组件
 * 通过上下键选择固定选项，最后一项支持用户自定义输入
 */
const PlanQuestionPrompt: React.FC<PlanQuestionPromptProps> = ({
  interaction,
  onResolve,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isCustomEditing, setIsCustomEditing] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const customOptionIndex = interaction.options.length;
  const optionCount = interaction.options.length + 1;

  /** 构建包含自定义输入的完整选项列表 */
  const allOptions = useMemo(() => {
    return [
      ...interaction.options,
      {
        label: CUSTOM_OPTION_LABEL,
        description: "输入不在列表中的自定义回答",
      },
    ];
  }, [interaction.options]);

  /** 提交当前选中的固定选项 */
  const submitSelectedOption = () => {
    const selectedOption = interaction.options[selectedIndex];
    if (!selectedOption) return;

    onResolve({
      answer: `我选择：${selectedOption.label}`,
      displayText: `选择：${selectedOption.label}`,
      isCustom: false,
    });
  };

  /** 提交自定义输入内容 */
  const submitCustomValue = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    onResolve({
      answer: trimmedValue,
      displayText: trimmedValue,
      isCustom: true,
    });
  };

  useInput((input, key) => {
    if (isCustomEditing) {
      if (key.escape) {
        setIsCustomEditing(false);
        setCustomValue("");
      }
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : optionCount - 1));
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((prev) => (prev < optionCount - 1 ? prev + 1 : 0));
      return;
    }

    if (!key.return) return;

    if (selectedIndex === customOptionIndex) {
      setIsCustomEditing(true);
      return;
    }

    submitSelectedOption();
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🧭 计划问题确认
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>{interaction.title}</Text>
        <Text>{interaction.question}</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {allOptions.map((option, index) => {
          const isSelected = index === selectedIndex;
          const selectedColor = isSelected ? "cyan" : "gray";

          return (
            <Box key={`${option.label}-${index}`} flexDirection="column" marginBottom={1}>
              <Text color={selectedColor} bold={isSelected}>
                {isSelected ? "❯ " : "  "}
                {option.label}
              </Text>
              {option.description && (
                <Text color="gray">
                  {isSelected ? "  " : "    "}
                  {option.description}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      {isCustomEditing && (
        <Box
          flexDirection="column"
          marginBottom={1}
          borderStyle="single"
          borderColor="cyan"
          paddingX={1}
        >
          <Text color="gray">请输入你的自定义回答，按 Enter 提交，Esc 返回选项列表</Text>
          <TextInput
            value={customValue}
            onChange={setCustomValue}
            onSubmit={submitCustomValue}
            placeholder="输入你的回答..."
          />
        </Box>
      )}

      {!isCustomEditing && (
        <Text dimColor>[↑↓] 切换选项 [Enter] 确认</Text>
      )}
    </Box>
  );
};

export default PlanQuestionPrompt;
