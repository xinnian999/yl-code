import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { PendingChange } from "@/core/confirm-bus.ts";
import type { ConfirmResult } from "@/core/types.ts";
import { generateCompactDiff, type DiffLine } from "@/core/diff-generator.ts";
import { getEditorName, type EditorType } from "@/core/editor-detector.ts";
import { toDisplayCommand, toDisplayPath } from "@/core/path-display.ts";

/** 文件变更确认组件属性 */
interface DiffConfirmProps {
  change: PendingChange;
  onConfirm: (result: ConfirmResult) => void;
  editorOpened?: EditorType | null;
}

/** 可见行数 */
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
 * 文件变更确认组件
 */
const FileDiffConfirm: React.FC<DiffConfirmProps> = ({
  change,
  onConfirm,
  editorOpened,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);

  const diffResult = useMemo(() => {
    return generateCompactDiff(
      change.originalContent || "",
      change.newContent || "",
      3
    );
  }, [change.originalContent, change.newContent]);

  const maxScroll = Math.max(0, diffResult.lines.length - VISIBLE_LINES);
  const canScroll = diffResult.lines.length > VISIBLE_LINES;

  useInput((input, key) => {
    const lowerInput = input.toLowerCase();

    if (key.upArrow && canScroll) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow && canScroll) {
      setScrollOffset((prev) => Math.min(maxScroll, prev + 1));
      return;
    }
    if (input === "k" && canScroll) {
      setScrollOffset((prev) => Math.max(0, prev - 5));
      return;
    }
    if (input === "j" && canScroll) {
      setScrollOffset((prev) => Math.min(maxScroll, prev + 5));
      return;
    }

    if (lowerInput === "y" || key.return) {
      onConfirm("accept");
    } else if (lowerInput === "a") {
      onConfirm("accept_all");
    } else if (lowerInput === "n" || key.escape) {
      onConfirm("reject");
    }
  });

  const isNewFile = change.originalContent === "";
  const visibleLines = diffResult.lines.slice(
    scrollOffset,
    scrollOffset + VISIBLE_LINES
  );

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
          <Text color="gray">
            已在 {getEditorName(editorOpened)} 中打开 diff 视图
          </Text>
        </Box>
      )}

      {!editorOpened && (
        <Box marginBottom={1}>
          <Text color="green">+{diffResult.addedCount} </Text>
          <Text color="red">-{diffResult.removedCount} </Text>
          <Text color="gray">({diffResult.unchangedCount} 行未变)</Text>
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
          {canScroll && scrollOffset > 0 && (
            <Text color="gray" dimColor>
              ↑ 还有 {scrollOffset} 行
            </Text>
          )}

          {visibleLines.map((line, index) => (
            <DiffLineView key={scrollOffset + index} line={line} />
          ))}

          {canScroll && scrollOffset < maxScroll && (
            <Text color="gray" dimColor>
              ↓ 还有 {diffResult.lines.length - scrollOffset - VISIBLE_LINES} 行
            </Text>
          )}
        </Box>
      )}

      <Box flexDirection="column">
        {!editorOpened && canScroll && (
          <Box marginBottom={1}>
            <Text dimColor>[↑↓] 滚动 [j/k] 快速滚动</Text>
          </Box>
        )}

        <Box>
          <Text>
            <Text color="green" bold>[Y]</Text>
            <Text> 同意 </Text>
            <Text color="blue" bold>[A]</Text>
            <Text> 同意且不再询问 </Text>
            <Text color="red" bold>[N]</Text>
            <Text> 拒绝</Text>
          </Text>
        </Box>
      </Box>
    </Box>
  );
};

/**
 * 命令执行确认组件
 */
const CommandConfirm: React.FC<Omit<DiffConfirmProps, "editorOpened">> = ({
  change,
  onConfirm,
}) => {
  useInput((input, key) => {
    const lowerInput = input.toLowerCase();

    if (lowerInput === "y" || key.return) {
      onConfirm("accept");
    } else if (lowerInput === "a") {
      onConfirm("accept_all");
    } else if (lowerInput === "n" || key.escape) {
      onConfirm("reject");
    }
  });

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

      <Box marginBottom={1} flexDirection="column">
        <Text>
          命令: <Text color="cyan">{change.command ? toDisplayCommand(change.command) : ""}</Text>
        </Text>
        {change.workingDirectory && (
          <Text>
            目录: <Text color="gray">{toDisplayPath(change.workingDirectory)}</Text>
          </Text>
        )}
        {change.background && (
          <Text color="yellow"> (后台运行)</Text>
        )}
      </Box>

      <Box>
        <Text>
          <Text color="green" bold>[Y]</Text>
          <Text> 同意 </Text>
          <Text color="blue" bold>[A]</Text>
          <Text> 同意且不再询问 </Text>
          <Text color="red" bold>[N]</Text>
          <Text> 拒绝</Text>
        </Text>
      </Box>
    </Box>
  );
};

/**
 * 确认组件（根据类型渲染不同界面）
 */
const DiffConfirm: React.FC<DiffConfirmProps> = (props) => {
  if (props.change.type === "command") {
    return <CommandConfirm change={props.change} onConfirm={props.onConfirm} />;
  }
  return <FileDiffConfirm {...props} />;
};

export default DiffConfirm;
