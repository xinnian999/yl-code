import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import { ThinkingStatus } from "../utils/message-bus.js";

/**
 * Loading 动画字符
 */
const LOADING_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/**
 * 根据状态获取默认显示文本
 */
const getStatusText = (status, detail) => {
  if (detail) {
    return detail;
  }

  switch (status) {
    case ThinkingStatus.THINKING:
      return "玩命思考中...🐂🐎";
    case ThinkingStatus.TOOL_CALLING:
      return "正在执行工具...";
    case ThinkingStatus.WAITING:
      return "等待响应中...";
    default:
      return "";
  }
};

/**
 * 状态栏组件
 * 显示思考状态（位于左下角）
 */
const StatusBar = ({ thinkingStatus }) => {
  const [charIndex, setCharIndex] = useState(0);

  const { status, detail } = thinkingStatus || { status: ThinkingStatus.IDLE, detail: "" };
  const isActive = status !== ThinkingStatus.IDLE;

  useEffect(() => {
    if (!isActive) return;

    const interval = setInterval(() => {
      setCharIndex((prev) => (prev + 1) % LOADING_CHARS.length);
    }, 100);

    return () => clearInterval(interval);
  }, [isActive]);

  const statusText = getStatusText(status, detail);

  return (
    <Text color="yellow">
      {isActive ? `${LOADING_CHARS[charIndex]} ${statusText}` : statusText}
    </Text>
  );
};

export default StatusBar;
