import React from "react";
import { Box, Text } from "ink";
import { AGENT_MODES } from "@/core/types.ts";
import type { AgentModeValue, ContextUsage } from "@/core/types.ts";

/** 底部状态栏属性 */
export interface ComposerFooterProps {
  /** 当前工作模式 */
  mode: AgentModeValue;
  /** 是否开启调试模式 */
  debugMode: boolean;
  /** 上下文使用量 */
  contextUsage: ContextUsage;
  /** 是否正在压缩上下文 */
  isSummarizing: boolean;
}

/** 根据百分比返回颜色 */
function getUsageColor(percentage: number): string {
  if (percentage >= 80) {
    return "red";
  }

  if (percentage >= 50) {
    return "yellow";
  }

  return "green";
}

/** 底部状态栏 */
const ComposerFooter: React.FC<ComposerFooterProps> = ({
  mode,
  debugMode,
  contextUsage,
  isSummarizing,
}) => {
  const config = AGENT_MODES.find((modeItem) => modeItem.value === mode);
  const color = getUsageColor(contextUsage.percentage);

  return (
    <Box paddingX={2} justifyContent="flex-end" gap={2}>
      {isSummarizing ? (
        <Text bold color="cyan">
          压缩中...
        </Text>
      ) : null}
      <Text bold color={color}>
        上下文({contextUsage.percentage}%)
      </Text>
      {debugMode ? <Text bold dimColor>🐛 Debug模式</Text> : null}
      <Text bold dimColor>
        {config?.label}模式(Tab切换)
      </Text>
    </Box>
  );
};

export default ComposerFooter;
