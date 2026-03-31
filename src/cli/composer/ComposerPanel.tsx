import React, { useCallback, useMemo, useRef, useState } from "react";
import { Box } from "ink";
import { scanDirectory } from "@/core/file-scanner.ts";
import type { AgentModeValue, ContextUsage } from "@/core/types.ts";
import ComposerFooter from "./ComposerFooter.tsx";
import ComposerInput from "./ComposerInput.tsx";
import {
  deriveComposerSuggestionState,
  getFilteredCommands,
} from "./composer-state.ts";
import {
  useInputHistory,
  type HistoryNavigationResult,
} from "./useInputHistory.ts";
import { useComposerShortcuts } from "./useComposerShortcuts.ts";

/** 输入面板属性 */
export interface ComposerPanelProps {
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
  /** 是否有覆盖面板 */
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

/** 输入面板 */
const ComposerPanel: React.FC<ComposerPanelProps> = ({
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
  const [inputValue, setInputValue] = useState("");
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [fileSelectedIndex, setFileSelectedIndex] = useState(0);
  const [inputKey, setInputKey] = useState(0);
  const [suggestionState, setSuggestionState] = useState(() => {
    return deriveComposerSuggestionState("");
  });
  const isApplyingHistoryNavigationRef = useRef(false);
  const {
    pushHistory,
    navigateUp,
    navigateDown,
    resetNavigation,
    isNavigatingHistory,
  } =
    useInputHistory();

  /** 过滤后的命令建议 */
  const commandItems = useMemo(() => {
    return getFilteredCommands(inputValue);
  }, [inputValue]);

  /** 过滤后的文件建议 */
  const fileItems = useMemo(() => {
    if (!suggestionState.showFileSuggestions) {
      return [];
    }

    return scanDirectory(process.cwd(), suggestionState.fileFilter);
  }, [suggestionState.fileFilter, suggestionState.showFileSuggestions]);

  /** 执行命令并重置输入状态 */
  const executeCommand = useCallback(
    (commandValue: string) => {
      setInputValue("");
      setCommandSelectedIndex(0);
      setFileSelectedIndex(0);
      setSuggestionState(deriveComposerSuggestionState(""));
      onCommand(commandValue);
    },
    [onCommand],
  );

  /** 根据历史导航结果应用输入框状态，避免建议面板抢占上下键 */
  const applyHistoryNavigation = useCallback(
    (result: HistoryNavigationResult) => {
      if (result.nextValue === null) {
        return;
      }

      isApplyingHistoryNavigationRef.current = true;
      setInputValue(result.nextValue);
      setCommandSelectedIndex(0);
      setFileSelectedIndex(0);

      if (result.nextState.historyIndex !== -1) {
        setSuggestionState(deriveComposerSuggestionState(""));
        return;
      }

      setSuggestionState(deriveComposerSuggestionState(result.nextValue));
    },
    [],
  );

  /** 处理输入变化 */
  const handleInputChange = useCallback(
    (value: string) => {
      setInputValue(value);
      setSuggestionState(deriveComposerSuggestionState(value));
      setCommandSelectedIndex(0);
      setFileSelectedIndex(0);
      if (isApplyingHistoryNavigationRef.current) {
        isApplyingHistoryNavigationRef.current = false;
        return;
      }

      resetNavigation();
    },
    [resetNavigation],
  );

  /** 处理提交 */
  const handleSubmit = useCallback(
    (value: string) => {
      if (
        suggestionState.showCommandSuggestions ||
        suggestionState.showFileSuggestions
      ) {
        return;
      }

      const trimmedValue = value.trim();
      if (!trimmedValue || isProcessing) {
        return;
      }

      setInputValue("");
      setSuggestionState(deriveComposerSuggestionState(""));
      pushHistory(trimmedValue);
      onSubmit(trimmedValue);
    },
    [isProcessing, onSubmit, pushHistory, suggestionState],
  );

  /** 取消文件建议 */
  const clearFileSuggestions = useCallback(() => {
    setFileSelectedIndex(0);
    setSuggestionState((currentState) => ({
      ...currentState,
      showFileSuggestions: false,
      fileFilter: "",
      atStartIndex: -1,
    }));
  }, []);

  useComposerShortcuts({
    isProcessing,
    hasOverlay,
    inputValue,
    suggestionState,
    commandItems,
    commandSelectedIndex,
    fileItems,
    fileSelectedIndex,
    setInputValue,
    setCommandSelectedIndex,
    setFileSelectedIndex,
    setSuggestionState,
    bumpInputKey: () => {
      setInputKey((currentKey) => currentKey + 1);
    },
    clearFileSuggestions,
    executeCommand,
    applyHistoryNavigation,
    isNavigatingHistory,
    navigateUp,
    navigateDown,
    onAbort,
    onModeSwitch,
  });

  return (
    <Box flexDirection="column">
      <ComposerInput
        value={inputValue}
        onChange={handleInputChange}
        onSubmit={handleSubmit}
        isDisabled={isProcessing}
        inputKey={inputKey}
        showCommandSuggestions={suggestionState.showCommandSuggestions}
        commandItems={commandItems}
        commandSelectedIndex={commandSelectedIndex}
        showFileSuggestions={suggestionState.showFileSuggestions}
        fileItems={fileItems}
        fileSelectedIndex={fileSelectedIndex}
        fileFilter={suggestionState.fileFilter}
      />
      <ComposerFooter
        mode={mode}
        debugMode={debugMode}
        contextUsage={contextUsage}
        isSummarizing={isSummarizing}
      />
    </Box>
  );
};

export default ComposerPanel;
