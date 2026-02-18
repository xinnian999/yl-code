import React, { useMemo } from "react";
import { Box, Text } from "ink";
import { scanDirectory, type FileItem } from "@/core/file-scanner.ts";

/** 文件补全列表组件属性 */
interface Props {
  selectedIndex: number;
  filter: string;
  maxItems?: number;
}

/**
 * 文件补全列表组件
 * 在输入框上方显示可选文件/目录列表
 */
const FileSuggestions: React.FC<Props> = ({
  selectedIndex,
  filter,
  maxItems = 8,
}) => {
  const files = useMemo(() => {
    return scanDirectory(process.cwd(), filter);
  }, [filter]);

  if (files.length === 0) {
    return (
      <Box marginBottom={1} paddingLeft={1}>
        <Text color="gray">没有匹配的文件或目录</Text>
      </Box>
    );
  }

  const startIndex = Math.max(
    0,
    Math.min(selectedIndex - Math.floor(maxItems / 2), files.length - maxItems)
  );
  const visibleFiles = files.slice(startIndex, startIndex + maxItems);
  const actualSelectedIndex = selectedIndex - startIndex;

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Box marginBottom={1}>
        <Text color="gray">
          📂 {filter ? `${process.cwd()}/${filter}` : process.cwd()}
        </Text>
      </Box>

      {startIndex > 0 && (
        <Text color="gray" dimColor>
          {"  "}↑ 还有 {startIndex} 项...
        </Text>
      )}

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

      {startIndex + maxItems < files.length && (
        <Text color="gray" dimColor>
          {"  "}↓ 还有 {files.length - startIndex - maxItems} 项...
        </Text>
      )}

      <Box marginTop={1}>
        <Text color="gray" dimColor>
          ↑↓ 选择 | Enter 确认 | Esc 取消
        </Text>
      </Box>
    </Box>
  );
};

export default FileSuggestions;

/**
 * 获取过滤后的文件列表（供外部使用）
 */
export function getFilteredFiles(filter: string): FileItem[] {
  return scanDirectory(process.cwd(), filter);
}
