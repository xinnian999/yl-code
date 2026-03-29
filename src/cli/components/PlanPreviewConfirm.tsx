import React from "react";
import { Box, Text } from "ink";
import type { PendingPlanPreview } from "@/core/plan/plan-bus.ts";

/** 计划预览卡片组件属性 */
interface PlanPreviewConfirmProps {
  /** 当前待确认的计划 */
  interaction: PendingPlanPreview;
}

/**
 * 计划预览确认卡片
 * 纯展示组件，不包含交互逻辑，SelectInput 由外层统一管理
 */
const PlanPreviewConfirm: React.FC<PlanPreviewConfirmProps> = ({
  interaction,
}) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          📋 计划确认
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text bold>已生成最终计划：{interaction.title}</Text>
        <Text dimColor>完整计划已在上方消息区静态渲染。</Text>
        <Text dimColor>确认执行会直接开始实现；选择修改计划后，会恢复输入框供你继续补充要求。</Text>
      </Box>
    </Box>
  );
};

export default PlanPreviewConfirm;
