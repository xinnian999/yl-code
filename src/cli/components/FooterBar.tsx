import React from "react";
import { Box, Text } from "ink";
import { AGENT_MODES } from "@/core/types.ts";
import type { AgentModeValue, ContextUsage } from "@/core/types.ts";

/** 底部状态栏组件属性 */
interface Props {
  mode: AgentModeValue;
  debugMode: boolean;
  contextUsage: ContextUsage;
  isSummarizing: boolean;
}

/** 根据百分比返回颜色 */
function getUsageColor(percentage: number): string {
  if (percentage >= 80) return "red";
  if (percentage >= 50) return "yellow";
  return "green";
}

/**
 * 底部状态栏组件
 * 在右下角显示当前工作模式、调试状态和上下文使用量
 */
const FooterBar: React.FC<Props> = ({ mode, debugMode, contextUsage, isSummarizing }) => {
  const config = AGENT_MODES.find((m) => m.value === mode);
  const color = getUsageColor(contextUsage.percentage);

  return (
    <Box paddingX={1} justifyContent="flex-end" gap={2}>
      {isSummarizing && <Text bold color="cyan">压缩中...</Text>}
      <Text bold color={color}>
        上下文({contextUsage.percentage}%)
      </Text>
      {debugMode && <Text bold color="gray">🐛 Debug模式</Text>}
      <Text bold color="gray">{config?.label}模式(Tab切换)</Text>
    </Box>
  );
};

export default FooterBar;
