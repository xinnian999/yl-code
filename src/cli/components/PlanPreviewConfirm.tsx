import React from "react";
import { Box, Text, useInput } from "ink";
import type {
  PendingPlanPreview,
  PlanPreviewResult,
} from "@/core/plan/plan-bus.ts";

/** 计划预览组件属性 */
interface PlanPreviewConfirmProps {
  /** 当前待确认的计划 */
  interaction: PendingPlanPreview;
  /** 用户完成操作后的回调 */
  onResolve: (result: PlanPreviewResult) => void;
}

/**
 * 计划预览组件
 * 仅提供确认执行或返回修改两种选择，不在此处承载输入行为
 */
const PlanPreviewConfirm: React.FC<PlanPreviewConfirmProps> = ({
  interaction,
  onResolve,
}) => {
  useInput((input, key) => {
    const lowerInput = input.toLowerCase();

    if (lowerInput === "y" || key.return) {
      onResolve({ action: "execute" });
      return;
    }

    if (lowerInput === "m") {
      onResolve({ action: "revise" });
    }
  });

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

      <Box flexDirection="column" marginBottom={1}>
        <Text bold>已生成最终计划：{interaction.title}</Text>
        <Text dimColor>完整计划已在上方消息区静态渲染。</Text>
        <Text dimColor>确认执行会直接开始实现；选择修改计划后，会恢复输入框供你继续补充要求。</Text>
      </Box>

      <Box flexDirection="column">
        <Text>
          <Text color="green" bold>[Y]</Text>
          <Text> 确认执行 </Text>
          <Text color="cyan" bold>[M]</Text>
          <Text> 修改计划</Text>
        </Text>
      </Box>
    </Box>
  );
};

export default PlanPreviewConfirm;
