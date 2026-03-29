import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { PendingChange } from "@/core/confirm-bus.ts";
import { generateCompactDiff, type DiffLine } from "@/core/diff-generator.ts";
import { getEditorName, type EditorType } from "@/core/editor-detector.ts";
import { toDisplayPath } from "@/core/path-display.ts";

/** 文件变更确认卡片组件属性 */
interface FileDiffConfirmProps {
  /** 待确认的变更信息 */
  change: PendingChange;
  /** 已打开的外部编辑器类型 */
  editorOpened?: EditorType | null;
}

/** 最多展示行数 */
const VISIBLE_LINES = 20;

/**
 * 渲染单行 diff
 */
const DiffLineView: React.FC<{ line: DiffLine }> = ({ line }) => {
  const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
  const color =
    line.type === "add" ? "green" : line.type === "remove" ? "red" : "gray";

  return (
    <Text color={color}>
      {prefix} {line.content}
    </Text>
  );
};

/**
 * 文件变更确认卡片
 * 纯展示组件，不包含交互逻辑，SelectInput 由外层统一管理
 */
const FileDiffConfirm: React.FC<FileDiffConfirmProps> = ({
  change,
  editorOpened,
}) => {
  const diffResult = useMemo(() => {
    return generateCompactDiff(
      change.originalContent || "",
      change.newContent || "",
      3
    );
  }, [change.originalContent, change.newContent]);

  const isNewFile = change.originalContent === "";
  const visibleLines = diffResult.lines.slice(0, VISIBLE_LINES);
  const hiddenCount = diffResult.lines.length - VISIBLE_LINES;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          📝 文件变更确认
        </Text>
      </Box>

      <Box marginBottom={1}>
        <Text>
          文件: <Text color="cyan">{change.filePath ? toDisplayPath(change.filePath) : ""}</Text>
          {isNewFile && <Text color="green"> (新文件)</Text>}
        </Text>
      </Box>

      {editorOpened && (
        <Box marginBottom={1}>
          <Text dimColor>
            已在 {getEditorName(editorOpened)} 中打开 diff 视图
          </Text>
        </Box>
      )}

      {!editorOpened && (
        <Box marginBottom={1}>
          <Text color="green">+{diffResult.addedCount} </Text>
          <Text color="red">-{diffResult.removedCount} </Text>
          <Text dimColor>({diffResult.unchangedCount} 行未变)</Text>
        </Box>
      )}

      {(!editorOpened || isNewFile) && (
        <Box
          flexDirection="column"
          marginBottom={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          {visibleLines.map((line, index) => (
            <DiffLineView key={index} line={line} />
          ))}
          {hiddenCount > 0 && (
            <Text dimColor>... 还有 {hiddenCount} 行未显示</Text>
          )}
        </Box>
      )}
    </Box>
  );
};

export default FileDiffConfirm;
