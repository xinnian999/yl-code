import React, { useState, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import MessageList from "./components/MessageList.tsx";
import InputBox from "./components/InputBox.tsx";
import StatusBar from "./components/StatusBar.tsx";
import CommandSuggestions from "./components/CommandSuggestions.tsx";
import ModelSelector from "./features/model/ModelSelector.tsx";
import FileSuggestions, { getFilteredFiles } from "./features/file-picker/FileSuggestions.tsx";
import DiffConfirm from "./features/diff/DiffConfirm.tsx";
import { commands } from "./commands.ts";
import { useMessages } from "./hooks/useMessages.ts";
import { useDiffConfirm } from "./hooks/useDiffConfirm.ts";
import { useHistory } from "./hooks/useHistory.ts";
import { ThinkingStatus, type ModelConfig } from "@/core/types.ts";
import type { Agent } from "@/core/agent.ts";
import { extractAtFilter, parseAtReferences, getFileContent } from "./features/file-picker/file-scanner.ts";
import { join } from "path";

export interface AppProps {
  agent: Agent;
}

const App: React.FC<AppProps> = ({ agent }) => {
  const { messageBus, confirmBus, config } = agent;

  const { exit } = useApp();
  const { messages, thinkingStatus } = useMessages(messageBus);
  const { showDiffConfirm, pendingChange, diffEditorOpened, handleDiffConfirm } = useDiffConfirm(confirmBus);
  const { pushHistory, navigateUp, navigateDown, resetNavigation } = useHistory();

  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSelectingModel, setIsSelectingModel] = useState(false);
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [showFileSuggestions, setShowFileSuggestions] = useState(false);
  const [fileSelectedIndex, setFileSelectedIndex] = useState(0);
  const [fileFilter, setFileFilter] = useState("");
  const [atStartIndex, setAtStartIndex] = useState(-1);
  const [inputKey, setInputKey] = useState(0);

  const handleExit = useCallback(() => {
    agent.dispose();
    exit();
  }, [agent, exit]);

  const getFilteredCommands = useCallback(() => {
    return commands.filter((cmd) => `/${cmd.value}`.startsWith(inputValue));
  }, [inputValue]);

  const executeCommand = useCallback((commandValue: string) => {
    setShowCommandSuggestions(false);
    setInputValue("");
    setCommandSelectedIndex(0);

    switch (commandValue) {
      case "model":
        setIsSelectingModel(true);
        break;
      case "clear":
        messageBus.clearMessages();
        agent.clearMemory();
        confirmBus.resetSession();
        messageBus.createAIMessage();
        messageBus.ai("🧹 对话和记忆已清空");
        break;
      case "help":
        messageBus.createAIMessage();
        messageBus.ai(`📖 可用命令：

/model  - 切换 AI 模型
/clear  - 清空对话历史
/help   - 显示帮助信息
/exit   - 退出程序

其他：
- 输入 exit 或 quit 也可退出
- 按 ↑↓ 键可切换历史命令
- 按 Ctrl+C 强制退出
- 输入 @ 可引用文件/目录`);
        break;
      case "exit":
        messageBus.ai("👋 再见！");
        setTimeout(() => handleExit(), 500);
        break;
    }
  }, [handleExit, agent, messageBus, confirmBus]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") { handleExit(); }

    // 文件补全键盘处理
    if (showFileSuggestions && !isSelectingModel) {
      const filteredFiles = getFilteredFiles(fileFilter);
      if (key.upArrow) { setFileSelectedIndex((p) => p > 0 ? p - 1 : filteredFiles.length - 1); return; }
      if (key.downArrow) { setFileSelectedIndex((p) => p < filteredFiles.length - 1 ? p + 1 : 0); return; }
      if (key.return && filteredFiles.length > 0) {
        const selected = filteredFiles[fileSelectedIndex];
        if (selected) {
          const beforeAt = inputValue.slice(0, atStartIndex);
          if (selected.isDirectory) {
            const newFilter = selected.relativePath + "/";
            setFileFilter(newFilter);
            setFileSelectedIndex(0);
            setInputValue(beforeAt + "@" + newFilter);
          } else {
            setInputValue(beforeAt + "@" + selected.relativePath + " ");
            setShowFileSuggestions(false);
            setFileSelectedIndex(0);
            setFileFilter("");
            setAtStartIndex(-1);
          }
          setInputKey((k) => k + 1);
        }
        return;
      }
      if (key.escape) { setShowFileSuggestions(false); setFileSelectedIndex(0); setFileFilter(""); setAtStartIndex(-1); return; }
    }

    // 命令补全键盘处理
    if (showCommandSuggestions && !isSelectingModel) {
      const filtered = getFilteredCommands();
      if (key.upArrow) { setCommandSelectedIndex((p) => p > 0 ? p - 1 : filtered.length - 1); return; }
      if (key.downArrow) { setCommandSelectedIndex((p) => p < filtered.length - 1 ? p + 1 : 0); return; }
      if (key.return && filtered.length > 0) { const cmd = filtered[commandSelectedIndex]; if (cmd) executeCommand(cmd.value); return; }
      if (key.escape) { setShowCommandSuggestions(false); setInputValue(""); setCommandSelectedIndex(0); return; }
    }

    // 历史命令导航
    if (!isProcessing && !showCommandSuggestions && !isSelectingModel) {
      if (key.upArrow) { const val = navigateUp(inputValue); if (val !== null) setInputValue(val); }
      if (key.downArrow) { const val = navigateDown(); if (val !== null) setInputValue(val); }
    }
  });

  const handleSubmit = useCallback(async (value: string) => {
    if (showCommandSuggestions || showFileSuggestions) return;
    const trimmedValue = value.trim();
    if (!trimmedValue || isProcessing) return;

    if (trimmedValue.toLowerCase() === "exit" || trimmedValue.toLowerCase() === "quit") {
      messageBus.ai("👋 再见！");
      setTimeout(() => handleExit(), 500);
      return;
    }

    setInputValue("");
    setIsProcessing(true);
    pushHistory(trimmedValue);

    const atRefs = parseAtReferences(trimmedValue);
    let fileContext = "";
    if (atRefs.length > 0) {
      const contents = atRefs.map((ref) => {
        const fullPath = join(process.cwd(), ref);
        return `--- 文件: ${ref} ---\n${getFileContent(fullPath)}\n--- 文件结束 ---`;
      });
      fileContext = "\n\n" + contents.join("\n\n");
    }

    messageBus.user(trimmedValue);

    try {
      await agent.run(trimmedValue, fileContext);
    } catch (error) {
      messageBus.createAIMessage();
      const err = error as Error;
      messageBus.error(err?.message || String(error));
    } finally {
      setIsProcessing(false);
      messageBus.setThinkingStatus(ThinkingStatus.IDLE);
    }
  }, [isProcessing, handleExit, showCommandSuggestions, showFileSuggestions, agent, pushHistory, messageBus]);

  const handleModelSelect = useCallback((model: ModelConfig) => {
    config.setCurrentModel(model.id);
    messageBus.createAIMessage();
    messageBus.ai(`✅ 已切换到: ${model.name}`);
    setIsSelectingModel(false);
  }, [config, messageBus]);

  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    if (value.startsWith("/")) {
      setShowCommandSuggestions(true);
      setShowFileSuggestions(false);
      setCommandSelectedIndex(0);
    } else {
      setShowCommandSuggestions(false);
      const atInfo = extractAtFilter(value);
      if (atInfo) {
        setShowFileSuggestions(true);
        setFileFilter(atInfo.filter);
        setAtStartIndex(atInfo.atIndex);
        setFileSelectedIndex(0);
      } else {
        setShowFileSuggestions(false);
        setFileFilter("");
        setAtStartIndex(-1);
      }
    }
    resetNavigation();
  }, [resetNavigation]);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {showDiffConfirm && pendingChange ? (
        <DiffConfirm change={pendingChange} onConfirm={handleDiffConfirm} editorOpened={diffEditorOpened} />
      ) : isSelectingModel ? (
        <ModelSelector
          configManager={config}
          messageBus={messageBus}
          onSelect={handleModelSelect}
          onCancel={() => setIsSelectingModel(false)}
        />
      ) : (
        <>
          <MessageList messages={messages} />
          {showCommandSuggestions && <CommandSuggestions selectedIndex={commandSelectedIndex} filter={inputValue} />}
          {showFileSuggestions && <FileSuggestions selectedIndex={fileSelectedIndex} filter={fileFilter} />}
          <InputBox value={inputValue} onChange={handleInputChange} onSubmit={handleSubmit} isDisabled={isProcessing} inputKey={inputKey} />
          <Box marginTop={1} justifyContent="space-between" paddingX={1}>
            <StatusBar thinkingStatus={thinkingStatus} />
            <Text color="gray" dimColor>{""}</Text>
          </Box>
        </>
      )}
    </Box>
  );
};

export default App;
