import React from "react";
import { Box, Text } from "ink";
import type { PendingChange } from "@/core/confirm-bus.ts";
import { toDisplayCommand, toDisplayPath } from "@/core/path-display.ts";

/** 命令执行确认卡片组件属性 */
interface CommandConfirmProps {
  /** 待确认的变更信息 */
  change: PendingChange;
}

/**
 * 命令执行确认卡片
 * 纯展示组件，不包含交互逻辑，SelectInput 由外层统一管理
 */
const CommandConfirm: React.FC<CommandConfirmProps> = ({ change }) => {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="magenta"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="magenta">
          ⚡ 命令执行确认
        </Text>
      </Box>

      <Box flexDirection="column">
        <Text>
          命令: <Text color="cyan">{change.command ? toDisplayCommand(change.command) : ""}</Text>
        </Text>
        {change.workingDirectory && (
          <Text>
            目录: <Text dimColor>{toDisplayPath(change.workingDirectory)}</Text>
          </Text>
        )}
        {change.background && (
          <Text color="yellow"> (后台运行)</Text>
        )}
      </Box>
    </Box>
  );
};

export default CommandConfirm;
