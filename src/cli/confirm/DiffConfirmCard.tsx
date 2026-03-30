import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { PendingChange } from "@/core/confirm-bus.ts";
import { generateCompactDiff, type DiffLine } from "@/core/diff-generator.ts";
import { getEditorName, type EditorType } from "@/core/editor-detector.ts";
import { toDisplayCommand, toDisplayPath } from "@/core/path-display.ts";

/** Diff 确认卡片属性 */
export interface DiffConfirmCardProps {
  /** 待确认的变更 */
  change: PendingChange;
  /** 已打开的外部编辑器类型 */
  editorOpened?: EditorType | null;
}

/** 命令确认卡片属性 */
interface CommandConfirmCardProps {
  /** 待确认变更 */
  change: PendingChange;
}

/** 文件确认卡片属性 */
interface FileConfirmCardProps {
  /** 待确认变更 */
  change: PendingChange;
  /** 已打开编辑器 */
  editorOpened?: EditorType | null;
}

/** Diff 行属性 */
interface DiffLineViewProps {
  /** 单行 diff */
  line: DiffLine;
}

/** 渲染单行 diff */
const DiffLineView: React.FC<DiffLineViewProps> = ({ line }) => {
  const prefix = line.type === "add" ? "+" : line.type === "remove" ? "-" : " ";
  const color =
    line.type === "add" ? "green" : line.type === "remove" ? "red" : "gray";

  return (
    <Text color={color}>
      {prefix} {line.content}
    </Text>
  );
};

/** 命令执行确认卡片 */
const CommandConfirmCard: React.FC<CommandConfirmCardProps> = ({ change }) => {
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
          命令:
          {" "}
          <Text color="cyan">
            {change.command ? toDisplayCommand(change.command) : ""}
          </Text>
        </Text>
        {change.workingDirectory ? (
          <Text>
            目录:
            {" "}
            <Text dimColor>{toDisplayPath(change.workingDirectory)}</Text>
          </Text>
        ) : null}
        {change.background ? <Text color="yellow"> (后台运行)</Text> : null}
      </Box>
    </Box>
  );
};

/** 文件变更确认卡片 */
const FileConfirmCard: React.FC<FileConfirmCardProps> = ({
  change,
  editorOpened,
}) => {
  const diffResult = useMemo(() => {
    return generateCompactDiff(
      change.originalContent || "",
      change.newContent || "",
      3,
    );
  }, [change.newContent, change.originalContent]);
  const isNewFile = change.originalContent === "";

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
          文件:
          {" "}
          <Text color="cyan">
            {change.filePath ? toDisplayPath(change.filePath) : ""}
          </Text>
          {isNewFile ? <Text color="green"> (新文件)</Text> : null}
        </Text>
      </Box>

      {editorOpened ? (
        <Box marginBottom={1}>
          <Text dimColor>已在 {getEditorName(editorOpened)} 中打开 diff 视图</Text>
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Text color="green">+{diffResult.addedCount} </Text>
          <Text color="red">-{diffResult.removedCount} </Text>
          <Text dimColor>({diffResult.unchangedCount} 行未变)</Text>
        </Box>
      )}

      {!editorOpened || isNewFile ? (
        <Box
          flexDirection="column"
          marginBottom={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          {diffResult.lines.map((line, index) => (
            <DiffLineView key={index} line={line} />
          ))}
        </Box>
      ) : null}
    </Box>
  );
};

/** 确认卡片路由组件 */
export const DiffConfirmCard: React.FC<DiffConfirmCardProps> = (props) => {
  if (props.change.type === "command") {
    return <CommandConfirmCard change={props.change} />;
  }

  return (
    <FileConfirmCard change={props.change} editorOpened={props.editorOpened} />
  );
};
