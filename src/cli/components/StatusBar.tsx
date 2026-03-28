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
  /** 是否隐藏思考状态 */
  hideThinking?: boolean;
}

/** 构建思考状态文本 */
function getThinkingText(thinkingStatus: ThinkingState): string {
  const { status, detail } = thinkingStatus || { status: ThinkingStatus.IDLE, detail: "" };
  if (status === ThinkingStatus.IDLE) {
    return "";
  }

  return getStatusText(status, detail);
}

/**
 * 状态栏组件
 * 将思考状态与任务计时合并为同一行展示
 */
const StatusBar: React.FC<StatusBarProps> = ({ thinkingStatus, timerText, hideThinking = false }) => {
  const thinkingText = getThinkingText(thinkingStatus);
  const shouldShowThinking = !hideThinking && thinkingText.length > 0;

  if (!shouldShowThinking) {
    return (
      <Box>
        <Text color="gray">{timerText}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="yellow"><Spinner type="dots" /> {thinkingText}</Text>
      <Text color="gray"> ｜ {timerText}</Text>
    </Box>
  );
};

export default StatusBar;
