import React from "react";
import { Text } from "ink";
import { AGENT_MODES } from "@/core/types.ts";
import type { AgentModeValue } from "@/core/types.ts";

/** 模式指示器组件属性 */
interface Props {
  mode: AgentModeValue;
}

/**
 * 模式指示器组件
 * 在右下角显示当前工作模式和切换提示
 */
const ModeIndicator: React.FC<Props> = ({ mode }) => {
  const config = AGENT_MODES.find((m) => m.value === mode);

  return (
    <Text dimColor>
      <Text bold>{config?.label}模式(Tab)</Text>
    </Text>
  );
};

export default ModeIndicator;
