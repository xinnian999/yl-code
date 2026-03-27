import React, { useMemo, useState } from "react";
import { Box, Text, useInput } from "ink";
import TextInput from "ink-text-input";
import type {
  PendingPlanPreview,
  PlanPreviewResult,
} from "@/core/plan/plan-bus.ts";

/** 计划预览组件属性 */
interface PlanPreviewConfirmProps {
  /** 当前待确认的计划 */
  interaction: PendingPlanPreview;
  /** 用户完成操作后的回调 */
  onResolve: (result: PlanPreviewResult) => void;
}

/** 可见的计划行数 */
const VISIBLE_LINES = 18;

/** 根据计划行内容推断显示颜色 */
function getPlanLineColor(line: string): string | undefined {
  const trimmedLine = line.trim();
  if (!trimmedLine) return undefined;
  if (trimmedLine.startsWith("#")) return "cyan";
  if (trimmedLine.startsWith("- ") || /^\d+\.\s/.test(trimmedLine)) {
    return "green";
  }
  return undefined;
}

/**
 * 计划预览组件
 * 支持滚动浏览计划，并可确认执行或输入修改意见
 */
const PlanPreviewConfirm: React.FC<PlanPreviewConfirmProps> = ({
  interaction,
  onResolve,
}) => {
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isEditingFeedback, setIsEditingFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");

  /** 计划内容按行拆分，便于复用 diff 式预览体验 */
  const planLines = useMemo(() => {
    return interaction.planMarkdown.split("\n");
  }, [interaction.planMarkdown]);

  const maxScroll = Math.max(0, planLines.length - VISIBLE_LINES);
  const canScroll = planLines.length > VISIBLE_LINES;
  const visibleLines = planLines.slice(
    scrollOffset,
    scrollOffset + VISIBLE_LINES
  );

  /** 提交修改意见 */
  const submitFeedback = (value: string) => {
    const trimmedValue = value.trim();
    if (!trimmedValue) return;

    onResolve({
      action: "revise",
      feedback: trimmedValue,
    });
  };

  useInput((input, key) => {
    const lowerInput = input.toLowerCase();

    if (isEditingFeedback) {
      if (key.escape) {
        setIsEditingFeedback(false);
        setFeedback("");
      }
      return;
    }

    if (key.upArrow && canScroll) {
      setScrollOffset((prev) => Math.max(0, prev - 1));
      return;
    }

    if (key.downArrow && canScroll) {
      setScrollOffset((prev) => Math.min(maxScroll, prev + 1));
      return;
    }

    if (lowerInput === "k" && canScroll) {
      setScrollOffset((prev) => Math.max(0, prev - 5));
      return;
    }

    if (lowerInput === "j" && canScroll) {
      setScrollOffset((prev) => Math.min(maxScroll, prev + 5));
      return;
    }

    if (lowerInput === "y" || key.return) {
      onResolve({ action: "execute" });
      return;
    }

    if (lowerInput === "m") {
      setIsEditingFeedback(true);
      return;
    }

    if (lowerInput === "n" || key.escape) {
      onResolve({ action: "cancel" });
    }
  });

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="yellow"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="yellow">
          📋 计划预览
        </Text>
      </Box>

      <Box marginBottom={1} flexDirection="column">
        <Text bold>{interaction.title}</Text>
        <Text color="gray">确认后将自动进入执行阶段</Text>
      </Box>

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
          <Text key={`${scrollOffset + index}-${line}`} color={getPlanLineColor(line)}>
            {line || " "}
          </Text>
        ))}

        {canScroll && scrollOffset < maxScroll && (
          <Text color="gray" dimColor>
            ↓ 还有 {planLines.length - scrollOffset - VISIBLE_LINES} 行
          </Text>
        )}
      </Box>

      {isEditingFeedback ? (
        <Box
          flexDirection="column"
          marginBottom={1}
          borderStyle="single"
          borderColor="yellow"
          paddingX={1}
        >
          <Text color="gray">请输入修改意见，按 Enter 提交，Esc 返回预览</Text>
          <TextInput
            value={feedback}
            onChange={setFeedback}
            onSubmit={submitFeedback}
            placeholder="输入你希望调整的计划..."
          />
        </Box>
      ) : (
        <Box flexDirection="column">
          {canScroll && (
            <Text dimColor>[↑↓] 滚动 [j/k] 快速滚动</Text>
          )}
          <Text>
            <Text color="green" bold>[Y]</Text>
            <Text> 确认执行 </Text>
            <Text color="cyan" bold>[M]</Text>
            <Text> 修改计划 </Text>
            <Text color="red" bold>[N]</Text>
            <Text> 暂不执行</Text>
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default PlanPreviewConfirm;
