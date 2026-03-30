import React from "react";
import { Box, Text } from "ink";
import type { FileItem } from "@/core/file-scanner.ts";

/** 命令建议列表属性 */
export interface CommandSuggestionsProps {
  /** 过滤后的命令项 */
  commands: Array<{ value: string; description: string }>;
  /** 当前选中索引 */
  selectedIndex: number;
}

/** 命令建议列表 */
export const CommandSuggestions: React.FC<CommandSuggestionsProps> = ({
  commands,
  selectedIndex,
}) => {
  if (commands.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      {commands.map((command, index) => {
        const isSelected = index === selectedIndex;

        return (
          <Box key={command.value}>
            <Text
              color={isSelected ? "cyan" : undefined}
              dimColor={!isSelected}
              bold={isSelected}
            >
              {isSelected ? "❯ " : "  "}
              /{command.value}  {command.description}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};

/** 文件建议列表属性 */
export interface FileSuggestionsProps {
  /** 过滤后的文件项 */
  files: FileItem[];
  /** 当前选中索引 */
  selectedIndex: number;
  /** 当前过滤词 */
  filter: string;
  /** 最大展示数 */
  maxItems?: number;
}

/** 文件建议列表 */
export const FileSuggestions: React.FC<FileSuggestionsProps> = ({
  files,
  selectedIndex,
  filter,
  maxItems = 8,
}) => {
  if (files.length === 0) {
    return (
      <Box marginBottom={1} paddingLeft={1}>
        <Text dimColor>没有匹配的文件或目录</Text>
      </Box>
    );
  }

  const startIndex = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(maxItems / 2), files.length - maxItems),
  );
  const visibleFiles = files.slice(startIndex, startIndex + maxItems);
  const actualSelectedIndex = selectedIndex - startIndex;

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Box marginBottom={1}>
        <Text dimColor>
          📂 {filter ? `${process.cwd()}/${filter}` : process.cwd()}
        </Text>
      </Box>

      {startIndex > 0 ? (
        <Text dimColor>  ↑ 还有 {startIndex} 项...</Text>
      ) : null}

      {visibleFiles.map((file, index) => {
        const isSelected = index === actualSelectedIndex;
        const icon = file.isDirectory ? "📁" : "📄";

        return (
          <Box key={file.relativePath}>
            <Text color={isSelected ? "cyan" : "gray"} bold={isSelected}>
              {isSelected ? "❯ " : "  "}
              {icon}{" "}
              <Text color={isSelected ? "cyan" : "white"}>
                {file.relativePath}
                {file.isDirectory ? "/" : ""}
              </Text>
            </Text>
          </Box>
        );
      })}

      {startIndex + maxItems < files.length ? (
        <Text dimColor>
          {"  "}↓ 还有 {files.length - startIndex - maxItems} 项...
        </Text>
      ) : null}

      <Box marginTop={1}>
        <Text dimColor>↑↓ 选择 | Enter 确认 | Esc 取消</Text>
      </Box>
    </Box>
  );
};
