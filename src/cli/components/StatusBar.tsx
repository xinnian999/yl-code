import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { ThinkingStatus, type ThinkingState } from "@/core/types.ts";

/**
 * 格式化耗时
 */
const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

/**
 * 根据状态获取默认显示文本
 */
const getStatusText = (status: string, detail: string): string => {
  if (detail) {
    return detail;
  }

  switch (status) {
    case ThinkingStatus.THINKING:
      return "玩命思考中...";
    case ThinkingStatus.TOOL_CALLING:
      return "正在执行工具...";
    case ThinkingStatus.WAITING:
      return "等待响应中...";
    default:
      return "";
  }
};

interface StatusBarProps {
  thinkingStatus: ThinkingState;
}

/**
 * 状态栏组件
 * 显示思考状态（位于左下角）+ 实时计时
 */
const StatusBar: React.FC<StatusBarProps> = ({ thinkingStatus }) => {
  const { status, detail } = thinkingStatus || { status: ThinkingStatus.IDLE, detail: "" };
  const isActive = status !== ThinkingStatus.IDLE;
  const statusText = getStatusText(status, detail);

  // 实时计时
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      // 开始计时
      startTimeRef.current = Date.now();
      setElapsed(0);

      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed(Date.now() - startTimeRef.current);
        }
      }, 100); // 每 100ms 更新一次

      return () => clearInterval(interval);
    } else {
      // 停止计时，重置
      startTimeRef.current = null;
      setElapsed(0);
    }
  }, [isActive, status, detail]); // detail 变化时也重新计时（切换工具时）

  return (
    <Box>
      {/* 思考状态 */}
      <Text color="yellow">
        {isActive && <><Spinner type="dots" /> </>}
        {statusText}
        {isActive && elapsed > 0 && <Text color="gray"> ({formatDuration(elapsed)})</Text>}
      </Text>
    </Box>
  );
};

export default StatusBar;
