import React, { useState, useCallback } from "react";
import { useInput } from "ink";
import InputBox from "./InputBox.tsx";
import CommandSuggestions from "./CommandSuggestions.tsx";
import FileSuggestions, { getFilteredFiles } from "./FileSuggestions.tsx";
import { commands } from "@/core/commands.ts";
import { extractAtFilter } from "@/core/file-scanner.ts";
import { useHistory } from "../hooks/useHistory.ts";

/** 输入区域组件属性 */
interface InputAreaProps {
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
  /** 是否有弹窗遮罩（此时禁用部分快捷键） */
  hasOverlay: boolean;
}

/**
 * 输入区域组件
 * 独立管理输入状态，避免输入变化触发父组件及消息列表的重渲染
 */
const InputArea: React.FC<InputAreaProps> = ({
  isProcessing, onSubmit, onAbort, onModeSwitch, onCommand, hasOverlay,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);
  const [showFileSuggestions, setShowFileSuggestions] = useState(false);
  const [fileSelectedIndex, setFileSelectedIndex] = useState(0);
  const [fileFilter, setFileFilter] = useState("");
  const [atStartIndex, setAtStartIndex] = useState(-1);
  const [inputKey, setInputKey] = useState(0);
  const { pushHistory, navigateUp, navigateDown, resetNavigation } = useHistory();

  /** 获取过滤后的命令列表 */
  const getFilteredCommands = useCallback(() => {
    return commands.filter((cmd) => `/${cmd.value}`.startsWith(inputValue));
  }, [inputValue]);

  /** 执行命令并重置输入状态 */
  const executeCommand = useCallback((commandValue: string) => {
    setShowCommandSuggestions(false);
    setInputValue("");
    setCommandSelectedIndex(0);
    onCommand(commandValue);
  }, [onCommand]);

  /** 处理键盘快捷键 */
  useInput((input, key) => {
    // 处理中时按 Esc 中断 AI 输出
    if (key.escape && isProcessing) { onAbort(); return; }

    // 文件补全键盘处理
    if (showFileSuggestions && !hasOverlay) {
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
    if (showCommandSuggestions && !hasOverlay) {
      const filtered = getFilteredCommands();
      if (key.upArrow) { setCommandSelectedIndex((p) => p > 0 ? p - 1 : filtered.length - 1); return; }
      if (key.downArrow) { setCommandSelectedIndex((p) => p < filtered.length - 1 ? p + 1 : 0); return; }
      if (key.return && filtered.length > 0) { const cmd = filtered[commandSelectedIndex]; if (cmd) executeCommand(cmd.value); return; }
      if (key.escape) { setShowCommandSuggestions(false); setInputValue(""); setCommandSelectedIndex(0); return; }
    }

    // 历史命令导航
    if (!isProcessing && !showCommandSuggestions && !hasOverlay) {
      if (key.upArrow) { const val = navigateUp(inputValue); if (val !== null) setInputValue(val); }
      if (key.downArrow) { const val = navigateDown(); if (val !== null) setInputValue(val); }
    }

    // Tab 切换工作模式
    if (key.tab && !showCommandSuggestions && !showFileSuggestions && !hasOverlay) {
      onModeSwitch();
    }
  }, {
    isActive: !hasOverlay,
  });

  /** 处理输入内容变化 */
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

  /** 处理消息提交 */
  const handleSubmit = useCallback((value: string) => {
    if (showCommandSuggestions || showFileSuggestions) return;
    const trimmedValue = value.trim();
    if (!trimmedValue || isProcessing) return;
    setInputValue("");
    pushHistory(trimmedValue);
    onSubmit(trimmedValue);
  }, [isProcessing, showCommandSuggestions, showFileSuggestions, pushHistory, onSubmit]);

  return (
    <>
      {showCommandSuggestions && <CommandSuggestions selectedIndex={commandSelectedIndex} filter={inputValue} />}
      {showFileSuggestions && <FileSuggestions selectedIndex={fileSelectedIndex} filter={fileFilter} />}
      <InputBox value={inputValue} onChange={handleInputChange} onSubmit={handleSubmit} isDisabled={isProcessing} inputKey={inputKey} />
    </>
  );
};

export default InputArea;
