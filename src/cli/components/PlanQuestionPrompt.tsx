import React from "react";
import { Box, Text } from "ink";
import type { PendingPlanQuestion } from "@/core/plan/plan-bus.ts";

/** 计划问题卡片组件属性 */
interface PlanQuestionPromptProps {
  /** 当前待回答的问题 */
  interaction: PendingPlanQuestion;
}

/**
 * 计划问题卡片
 * 纯展示组件，展示问题和选项列表，不包含交互逻辑
 * SelectInput 由外层 ConfirmSelectArea 统一管理
 */
const PlanQuestionPrompt: React.FC<PlanQuestionPromptProps> = ({
  interaction,
}) => {
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

      <Box flexDirection="column">
        <Text bold>{interaction.title}</Text>
        <Text>{interaction.question}</Text>
      </Box>
    </Box>
  );
};

export default PlanQuestionPrompt;
