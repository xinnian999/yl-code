import React from "react";
import { Box } from "ink";
import InputArea from "./InputArea.tsx";
import FooterBar from "./FooterBar.tsx";
import type { AgentModeValue, ContextUsage } from "@/core/types.ts";

/** 底部操作栏组件属性 */
interface BottomBarProps {
  /** 是否正在处理中 */
  isProcessing: boolean;
  /** 提交消息回调 */
  onSubmit: (value: string) => void;
  /** 中断处理回调 */
  onAbort: () => void;
  /** 切换模式回调 */
  onModeSwitch: () => void;
  /** 命令执行回调 */
  onCommand: (commandValue: string) => void;
  /** 是否有弹窗遮罩 */
  hasOverlay: boolean;
  /** 当前工作模式 */
  mode: AgentModeValue;
  /** 是否开启调试模式 */
  debugMode: boolean;
  /** 上下文使用量 */
  contextUsage: ContextUsage;
  /** 是否正在压缩上下文 */
  isSummarizing: boolean;
}

/**
 * 底部操作栏组件
 * 将输入区域和状态栏封装在一起，便于统一显示和隐藏
 */
const BottomBar: React.FC<BottomBarProps> = ({
  isProcessing,
  onSubmit,
  onAbort,
  onModeSwitch,
  onCommand,
  hasOverlay,
  mode,
  debugMode,
  contextUsage,
  isSummarizing,
}) => {
  return (
    <Box flexDirection="column">
      <InputArea
        isProcessing={isProcessing}
        onSubmit={onSubmit}
        onAbort={onAbort}
        onModeSwitch={onModeSwitch}
        onCommand={onCommand}
        hasOverlay={hasOverlay}
      />
      <FooterBar
        mode={mode}
        debugMode={debugMode}
        contextUsage={contextUsage}
        isSummarizing={isSummarizing}
      />
    </Box>
  );
};

export default BottomBar;
