import React, { useCallback, useEffect, useState } from "react";
import { Box, useApp, useInput } from "ink";
import MessageList from "./chat/MessageList.tsx";
import { useMessages } from "./chat/useMessages.ts";
import ComposerPanel from "./composer/ComposerPanel.tsx";
import { useContextUsage } from "./composer/useContextUsage.ts";
import ConfirmBar from "./confirm/ConfirmBar.tsx";
import { hasActiveConfirm } from "./confirm/active-confirm.ts";
import { useActiveConfirm } from "./confirm/useActiveConfirm.ts";
import { NEW_SESSION_ID } from "./panels/HistoryPanel.tsx";
import OverlayContent from "./panels/OverlayContent.tsx";
import { hasOverlayView, type OverlayView } from "./shared/view-state.ts";
import { AGENT_MODES } from "@/core/types.ts";
import type { ModelConfig, AgentModeValue } from "@/core/types.ts";
import type { Agent } from "@/core/agent/Agent.ts";

/** 主应用组件属性 */
export interface AppProps {
  agent: Agent;
}

/** 主应用组件 */
const App: React.FC<AppProps> = ({ agent }) => {
  const { exit } = useApp();
  const { messages, thinkingStatus, streamingBlockIndex } = useMessages(agent);
  const { usage: contextUsage, isSummarizing } = useContextUsage(agent);
  const {
    activeConfirm,
    pendingPlanInteraction,
    pendingChange,
    handlePlanQuestionResolve,
    handlePlanPreviewResolve,
    handleDiffConfirm,
  } = useActiveConfirm(agent);

  const [isProcessing, setIsProcessing] = useState(false);
  const [overlayView, setOverlayView] = useState<OverlayView>("none");
  const [currentMode, setCurrentMode] = useState<AgentModeValue>(() => agent.getMode());
  const [debugMode, setDebugMode] = useState(() => agent.isDebugMode());
  const isConfirmPending = hasActiveConfirm(activeConfirm);
  const hasOverlay = hasOverlayView(overlayView);

  // 启动时自动连接 MCP 服务器
  useEffect(() => { agent.init(); }, [agent]);

  // 同步 core 内部触发的模式变更（例如计划确认后自动进入 Build）
  useEffect(() => {
    return agent.onModeChange((mode) => {
      setCurrentMode(mode);
    });
  }, [agent]);

  /** 退出应用 */
  const handleExit = useCallback(() => {
    agent.dispose();
    exit();
  }, [agent, exit]);

  // 全局 Ctrl+C 退出（弹窗打开时 InputArea 未挂载，需保留此处理）
  useInput((input, key) => {
    if (key.ctrl && input === "c") handleExit();
  });

  /** 提交用户消息 */
  const handleSubmit = useCallback(async (value: string) => {
    if (value.toLowerCase() === "exit" || value.toLowerCase() === "quit") {
      agent.executeCommand("exit");
      setTimeout(() => handleExit(), 500);
      return;
    }
    setIsProcessing(true);
    await agent.chat(value);
    setIsProcessing(false);
  }, [agent, handleExit]);

  /** 处理命令执行结果 */
  const handleCommand = useCallback((commandValue: string) => {
    const result = agent.executeCommand(commandValue);
    setDebugMode(agent.isDebugMode());
    if (result.action === "select_model") {
      setOverlayView("model");
    }
    if (result.action === "show_history") {
      setOverlayView("history");
    }
    if (result.action === "manage_mcp") {
      setOverlayView("mcp");
    }
    if (result.action === "exit") {
      setTimeout(() => handleExit(), 500);
    }
  }, [agent, handleExit]);

  /** 中断 AI 输出 */
  const handleAbort = useCallback(() => {
    agent.abort();
    setIsProcessing(false);
  }, [agent]);

  /** 切换工作模式 */
  const handleModeSwitch = useCallback(() => {
    setCurrentMode((prev) => {
      const currentIndex = AGENT_MODES.findIndex((modeItem) => modeItem.value === prev);
      const nextMode = AGENT_MODES[(currentIndex + 1) % AGENT_MODES.length].value;
      agent.setMode(nextMode);
      return nextMode;
    });
  }, [agent]);

  /** 选择模型 */
  const handleModelSelect = useCallback((model: ModelConfig) => {
    agent.switchModel(model);
    setOverlayView("none");
  }, [agent]);

  /** 选择历史会话 */
  const handleHistorySelect = useCallback((sessionId: string) => {
    if (sessionId === NEW_SESSION_ID) {
      agent.newSession();
    } else {
      agent.restoreSession(sessionId);
    }
    setOverlayView("none");
  }, [agent]);

  /** 关闭当前覆盖面板 */
  const closeOverlay = useCallback(() => {
    setOverlayView("none");
  }, []);

  return (
    <Box flexDirection="column">
      {hasOverlay ? (
        <OverlayContent
          overlayView={overlayView}
          agent={agent}
          onModelSelect={handleModelSelect}
          onHistorySelect={handleHistorySelect}
          onClose={closeOverlay}
        />
      ) : (
        <>
          <MessageList
            messages={messages}
            thinkingStatus={thinkingStatus}
            streamingBlockIndex={streamingBlockIndex}
            isProcessing={isProcessing}
            pendingChange={pendingChange}
            diffEditorOpened={
              activeConfirm.kind === "diff" ? activeConfirm.diffEditorOpened : null
            }
            pendingPlanInteraction={pendingPlanInteraction}
            modelId={agent.getCurrentModelName()}
            version="1.0.11"
          />
          {isConfirmPending && (
            <ConfirmBar
              activeConfirm={activeConfirm}
              onDiffConfirm={handleDiffConfirm}
              onPlanQuestionResolve={handlePlanQuestionResolve}
              onPlanPreviewResolve={handlePlanPreviewResolve}
            />
          )}
          {!isConfirmPending && (
            <ComposerPanel
              isProcessing={isProcessing}
              onSubmit={handleSubmit}
              onAbort={handleAbort}
              onModeSwitch={handleModeSwitch}
              onCommand={handleCommand}
              hasOverlay={hasOverlay}
              mode={currentMode}
              debugMode={debugMode}
              contextUsage={contextUsage}
              isSummarizing={isSummarizing}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default App;
