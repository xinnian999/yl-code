import React from "react";
import { Box, Text } from "ink";
import { AGENT_MODES } from "@/core/types.ts";
import type { AgentModeValue } from "@/core/types.ts";

/** 模式指示器组件属性 */
interface Props {
  mode: AgentModeValue;
  debugMode: boolean;
}

/**
 * 模式指示器组件
 * 在右下角显示当前工作模式和切换提示
 */
const FooterBar: React.FC<Props> = ({ mode, debugMode }) => {
  const config = AGENT_MODES.find((m) => m.value === mode);

  return (
    <Box paddingX={1} justifyContent="flex-end" gap={2}>
      {debugMode && <Text bold color="gray">🐛 Debug模式</Text>}
      <Text bold color="gray">{config?.label}模式(Tab切换)</Text>
    </Box>
  );
};

export default FooterBar; 
