import React from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { ThinkingStatus, type ThinkingState } from "@/core/types.ts";
import { getStatusText } from "@/core/agent-helpers.ts";

/** 状态栏组件属性 */
interface StatusBarProps {
  /** 思考状态 */
  thinkingStatus: ThinkingState;
  /** 计时状态文本 */
  timerText: string;
}

/** 构建运行中的统一状态栏文案 */
function getRunningText(thinkingStatus: ThinkingState, timerText: string): string {
  const { status } = thinkingStatus || { status: ThinkingStatus.IDLE, detail: "" };
  const statusText = getStatusText(status);
  if (!statusText) {
    return "";
  }

  return timerText ? `${statusText}(${timerText})` : statusText;
}

/**
 * 状态栏组件
 * 将思考状态与任务计时合并为同一行展示
 */
const StatusBar: React.FC<StatusBarProps> = ({ thinkingStatus, timerText }) => {
  const runningText = getRunningText(thinkingStatus, timerText);
  const shouldShowRunning = runningText.length > 0;

  if (!shouldShowRunning) {
    return (
      <Box>
        <Text dimColor>{timerText}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="yellow"><Spinner type="dots" /> {runningText}</Text>
    </Box>
  );
};

export default StatusBar;
