import React, { useState, useEffect, useRef } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { ThinkingStatus, type ThinkingState } from "@/core/types.ts";
import { formatDuration, getStatusText } from "@/core/agent-helpers.ts";

/** 状态栏组件属性 */
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
      <Text color="yellow">
        {isActive && <><Spinner type="dots" /> </>}
        {statusText}
        {isActive && elapsed > 0 && <Text color="gray"> ({formatDuration(elapsed)})</Text>}
        {/* {isActive && <Text color="gray" dimColor> - 按 Esc 中断</Text>} */}
      </Text>
    </Box>
  );
};

export default StatusBar;
