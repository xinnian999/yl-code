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

  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isActive) {
      startTimeRef.current = Date.now();
      setElapsed(0);

      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed(Date.now() - startTimeRef.current);
        }
      }, 100);

      return () => clearInterval(interval);
    }

    startTimeRef.current = null;
    setElapsed(0);
  }, [isActive, status, detail]);

  return (
    <Box>
      <Text color="yellow">
        {isActive && <><Spinner type="dots" /> </>}
        {statusText}
        {isActive && elapsed > 0 && <Text color="gray"> ({formatDuration(elapsed)})</Text>}
      </Text>
    </Box>
  );
};

export default StatusBar;
