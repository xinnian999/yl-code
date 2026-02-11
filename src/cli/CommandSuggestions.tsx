import React from "react";
import { Box, Text } from "ink";
import { commands } from "./commands.ts";

interface Props {
  selectedIndex: number;
  filter: string;
}

/**
 * 命令补全列表组件
 * 在输入框上方显示可选命令列表
 */
const CommandSuggestions: React.FC<Props> = ({ selectedIndex, filter }) => {
  // 根据输入过滤命令
  const filteredCommands = commands.filter((cmd) =>
    `/${cmd.value}`.startsWith(filter)
  );

  if (filteredCommands.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      {filteredCommands.map((cmd, index) => {
        const isSelected = index === selectedIndex;
        return (
          <Box key={cmd.value}>
            <Text
              color={isSelected ? "cyan" : "gray"}
              bold={isSelected}
            >
              {isSelected ? "❯ " : "  "}
              <Text color={isSelected ? "cyan" : "#000"}>/{cmd.value}</Text>
              <Text color="gray">{"    "}{cmd.label.split("    ")[1]}</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

export default CommandSuggestions;
