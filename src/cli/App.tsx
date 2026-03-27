import React, { useState, useCallback, useEffect } from "react";
import { Box, useApp, useInput } from "ink";
import MessageList from "./components/MessageList.tsx";
import InputArea from "./components/InputArea.tsx";
import ModelSelector from "./components/ModelSelector.tsx";
import HistorySelector, { NEW_SESSION_ID } from "./components/HistorySelector.tsx";
import McpManagerView from "./components/McpManager.tsx";
import FooterBar from "./components/FooterBar.tsx";
import PlanInteraction from "./components/PlanInteraction.tsx";
import { useMessages } from "./hooks/useMessages.ts";
import { useDiffConfirm } from "./hooks/useDiffConfirm.ts";
import { usePlanInteraction } from "./hooks/usePlanInteraction.ts";
import { useContextUsage } from "./hooks/useContextUsage.ts";
import { AGENT_MODES } from "@/core/types.ts";
import type { ModelConfig, AgentModeValue } from "@/core/types.ts";
import type { Agent } from "@/core/agent.ts";

/** 主应用组件属性 */
export interface AppProps {
  agent: Agent;
}

/** 主应用组件 */
const App: React.FC<AppProps> = ({ agent }) => {
  const { exit } = useApp();
  const { messages, thinkingStatus, streamingBlockIndex } = useMessages(agent);
  const { usage: contextUsage, isSummarizing } = useContextUsage(agent);
  const { showDiffConfirm, pendingChange, diffEditorOpened, handleDiffConfirm } = useDiffConfirm(agent);
  const {
    showPlanInteraction,
    pendingPlanInteraction,
    handlePlanQuestionResolve,
    handlePlanPreviewResolve,
  } = usePlanInteraction(agent);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isSelectingModel, setIsSelectingModel] = useState(false);
  const [isSelectingHistory, setIsSelectingHistory] = useState(false);
  const [isManagingMcp, setIsManagingMcp] = useState(false);
  const [currentMode, setCurrentMode] = useState<AgentModeValue>(() => agent.getMode());
  const [debugMode, setDebugMode] = useState(false);

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
    if (result.action === "select_model") setIsSelectingModel(true);
    if (result.action === "show_history") setIsSelectingHistory(true);
    if (result.action === "manage_mcp") setIsManagingMcp(true);
    if (result.action === "exit") setTimeout(() => handleExit(), 500);
  }, [agent, handleExit]);

  /** 中断 AI 输出 */
  const handleAbort = useCallback(() => {
    agent.abort();
    setIsProcessing(false);
  }, [agent]);

  /** 切换工作模式 */
  const handleModeSwitch = useCallback(() => {
    setCurrentMode((prev) => {
      const currentIndex = AGENT_MODES.findIndex((m) => m.value === prev);
      const nextMode = AGENT_MODES[(currentIndex + 1) % AGENT_MODES.length].value;
      agent.setMode(nextMode);
      return nextMode;
    });
  }, [agent]);

  /** 选择模型 */
  const handleModelSelect = useCallback((model: ModelConfig) => {
    agent.switchModel(model);
    setIsSelectingModel(false);
  }, [agent]);

  /** 选择历史会话 */
  const handleHistorySelect = useCallback((sessionId: string) => {
    if (sessionId === NEW_SESSION_ID) {
      agent.newSession();
    } else {
      agent.restoreSession(sessionId);
    }
    setIsSelectingHistory(false);
  }, [agent]);

  const hasOverlay = showDiffConfirm
    || showPlanInteraction
    || isSelectingModel
    || isSelectingHistory
    || isManagingMcp;

  return (
    <Box flexDirection="column" height="100%" paddingY={1}>
      {isManagingMcp ? (
        <Box paddingX={1}><McpManagerView agent={agent} onClose={() => setIsManagingMcp(false)} /></Box>
      ) : isSelectingHistory ? (
        <Box paddingX={1}><HistorySelector agent={agent} onSelect={handleHistorySelect} onCancel={() => setIsSelectingHistory(false)} /></Box>
      ) : isSelectingModel ? (
        <Box paddingX={1}><ModelSelector agent={agent} onSelect={handleModelSelect} onCancel={() => setIsSelectingModel(false)} /></Box>
      ) : (
        <>
          <MessageList
            messages={messages}
            thinkingStatus={thinkingStatus}
            streamingBlockIndex={streamingBlockIndex}
            isProcessing={isProcessing}
            showDiffConfirm={showDiffConfirm}
            pendingChange={pendingChange}
            diffEditorOpened={diffEditorOpened}
            onDiffConfirm={handleDiffConfirm}
          />
          {showPlanInteraction && pendingPlanInteraction && (
            <Box paddingX={1} marginBottom={1}>
              <PlanInteraction
                interaction={pendingPlanInteraction}
                onResolveQuestion={handlePlanQuestionResolve}
                onResolvePreview={handlePlanPreviewResolve}
              />
            </Box>
          )}
          <InputArea
            isProcessing={isProcessing || showDiffConfirm || showPlanInteraction}
            onSubmit={handleSubmit}
            onAbort={handleAbort}
            onModeSwitch={handleModeSwitch}
            onCommand={handleCommand}
            hasOverlay={hasOverlay}
          />
          <FooterBar mode={currentMode} debugMode={debugMode} contextUsage={contextUsage} isSummarizing={isSummarizing} />
        </>
      )}
    </Box>
  );
};

export default App;
