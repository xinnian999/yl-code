import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import MessageList from "./MessageList.tsx";
import InputBox from "./InputBox.tsx";
import StatusBar from "./StatusBar.tsx";
import ModelSelector from "./ModelSelector.tsx";
import CommandSuggestions from "./CommandSuggestions.tsx";
import FileSuggestions, { getFilteredFiles } from "./FileSuggestions.tsx";
import { commands } from "./commands.ts";
import messageBus, { ThinkingStatus, type Message, type ThinkingState } from "@/utils/message-bus.ts";
import configBus, { type ModelConfig } from "@/utils/config-bus.ts";
import run, { clearMemory } from "@/core/run.ts";
import { cleanup } from "@/utils/process-manager.ts";
import { loadHistory, addToHistory } from "@/utils/history.ts";
import { extractAtFilter, parseAtReferences, getFileContent } from "@/utils/file-scanner.ts";
import { join } from "path";

const welcomeMessage = `您好老板！

我是《牛码》；

我擅长写代码、改BUG等；

有什么可以为您效劳的？😊`;

/**
 * 主应用组件
 */
const App: React.FC = () => {
  const { exit } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [thinkingStatus, setThinkingStatus] = useState<ThinkingState>({
    status: ThinkingStatus.IDLE,
    detail: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // 历史命令相关状态
  const [history, setHistory] = useState<string[]>(() => loadHistory()); // 从文件加载历史
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState(""); // 保存当前输入（用于从历史返回时恢复）

  // 模型选择状态
  const [isSelectingModel, setIsSelectingModel] = useState(false);

  // 命令选择状态
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);

  // 文件选择状态
  const [showFileSuggestions, setShowFileSuggestions] = useState(false);
  const [fileSelectedIndex, setFileSelectedIndex] = useState(0);
  const [fileFilter, setFileFilter] = useState("");
  const [atStartIndex, setAtStartIndex] = useState(-1);

  // 输入框 key，用于强制重新挂载以重置光标位置
  const [inputKey, setInputKey] = useState(0);

  // 订阅消息总线
  useEffect(() => {
    const handleMessage = (message: Message) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleMessageUpdate = (updatedMessage: Message) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === updatedMessage.id ? { ...updatedMessage } : msg
        )
      );
    };

    const handleThinking = (status: ThinkingState) => {
      setThinkingStatus(status);
    };

    const handleClear = () => {
      setMessages([]);
    };

    messageBus.on("message", handleMessage);
    messageBus.on("message:update", handleMessageUpdate);
    messageBus.on("thinking", handleThinking);
    messageBus.on("clear", handleClear);

    // 订阅完成后发送欢迎消息
    messageBus.ai(welcomeMessage);

    return () => {
      messageBus.off("message", handleMessage);
      messageBus.off("message:update", handleMessageUpdate);
      messageBus.off("thinking", handleThinking);
      messageBus.off("clear", handleClear);
    };
  }, []);

  // 获取过滤后的命令列表
  const getFilteredCommands = useCallback(() => {
    return commands.filter((cmd) =>
      `/${cmd.value}`.startsWith(inputValue)
    );
  }, [inputValue]);

  // 执行命令
  const executeCommand = useCallback((commandValue: string) => {
    setShowCommandSuggestions(false);
    setInputValue("");
    setCommandSelectedIndex(0);

    switch (commandValue) {
      case "model":
        setIsSelectingModel(true);
        break;
      case "clear":
        messageBus.emit("clear");
        clearMemory();
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
        setTimeout(() => {
          cleanup();
          exit();
        }, 500);
        break;
    }
  }, [exit]);

  // 处理键盘输入（退出 + 历史命令切换 + 命令补全选择 + 文件补全选择）
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      cleanup();
      exit();
    }

    // 文件补全模式下的键盘处理
    if (showFileSuggestions && !isSelectingModel) {
      const filteredFiles = getFilteredFiles(fileFilter);

      if (key.upArrow) {
        setFileSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredFiles.length - 1
        );
        return;
      }

      if (key.downArrow) {
        setFileSelectedIndex((prev) =>
          prev < filteredFiles.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (key.return && filteredFiles.length > 0) {
        const selectedFile = filteredFiles[fileSelectedIndex];
        if (selectedFile) {
          // 如果是目录，展开目录内容
          if (selectedFile.isDirectory) {
            const newFilter = selectedFile.relativePath + "/";
            setFileFilter(newFilter);
            setFileSelectedIndex(0);
            // 更新输入框
            const beforeAt = inputValue.slice(0, atStartIndex);
            setInputValue(beforeAt + "@" + newFilter);
            setInputKey((k) => k + 1); // 重置光标到末尾
          } else {
            // 如果是文件，插入完整路径并关闭补全
            const beforeAt = inputValue.slice(0, atStartIndex);
            const newValue = beforeAt + "@" + selectedFile.relativePath + " ";
            setInputValue(newValue);
            setInputKey((k) => k + 1); // 重置光标到末尾
            setShowFileSuggestions(false);
            setFileSelectedIndex(0);
            setFileFilter("");
            setAtStartIndex(-1);
          }
        }
        return;
      }

      if (key.escape) {
        setShowFileSuggestions(false);
        setFileSelectedIndex(0);
        setFileFilter("");
        setAtStartIndex(-1);
        return;
      }
    }

    // 命令补全模式下的键盘处理
    if (showCommandSuggestions && !isSelectingModel) {
      const filteredCommands = getFilteredCommands();
      
      if (key.upArrow) {
        setCommandSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredCommands.length - 1
        );
        return;
      }

      if (key.downArrow) {
        setCommandSelectedIndex((prev) =>
          prev < filteredCommands.length - 1 ? prev + 1 : 0
        );
        return;
      }

      if (key.return && filteredCommands.length > 0) {
        const selectedCommand = filteredCommands[commandSelectedIndex];
        if (selectedCommand) {
          executeCommand(selectedCommand.value);
        }
        return;
      }

      if (key.escape) {
        setShowCommandSuggestions(false);
        setInputValue("");
        setCommandSelectedIndex(0);
        return;
      }
    }

    // 上下键切换历史命令（非命令补全模式，非模型选择模式）
    if (!isProcessing && !showCommandSuggestions && !isSelectingModel && history.length > 0) {
      if (key.upArrow) {
        if (historyIndex === -1) {
          setTempInput(inputValue);
          setHistoryIndex(history.length - 1);
          setInputValue(history[history.length - 1]);
        } else if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          setInputValue(history[historyIndex - 1]);
        }
      }

      if (key.downArrow) {
        if (historyIndex !== -1) {
          if (historyIndex < history.length - 1) {
            setHistoryIndex(historyIndex + 1);
            setInputValue(history[historyIndex + 1]);
          } else {
            setHistoryIndex(-1);
            setInputValue(tempInput);
          }
        }
      }
    }
  });

  // 处理用户输入提交
  const handleSubmit = useCallback(
    async (value: string) => {
      // 如果处于命令补全模式或文件补全模式，不处理提交（由 useInput 处理）
      if (showCommandSuggestions || showFileSuggestions) {
        return;
      }

      const trimmedValue = value.trim();

      if (!trimmedValue || isProcessing) {
        return;
      }

      // 检查退出命令
      if (
        trimmedValue.toLowerCase() === "exit" ||
        trimmedValue.toLowerCase() === "quit"
      ) {
        messageBus.ai("👋 再见！");
        setTimeout(() => {
          cleanup();
          exit();
        }, 500);
        return;
      }

      // 清空输入
      setInputValue("");
      setIsProcessing(true);

      // 添加到历史记录并持久化
      const newHistory = addToHistory(history, trimmedValue);
      setHistory(newHistory);
      // 重置历史索引
      setHistoryIndex(-1);
      setTempInput("");

      // 解析 @ 引用并读取文件内容
      const atRefs = parseAtReferences(trimmedValue);
      let fileContext = "";
      if (atRefs.length > 0) {
        const fileContents: string[] = [];
        for (const ref of atRefs) {
          const fullPath = join(process.cwd(), ref);
          const content = getFileContent(fullPath);
          fileContents.push(`--- 文件: ${ref} ---\n${content}\n--- 文件结束 ---`);
        }
        fileContext = "\n\n" + fileContents.join("\n\n");
      }

      // 显示用户消息
      messageBus.user(trimmedValue);

      try {
        await run(trimmedValue, fileContext);
      } catch (error) {
        // 确保有一个 AI 消息来承载错误
        messageBus.createAIMessage();
        const err = error as Error;
        if (err) {
          messageBus.error(`${err.message || String(error)}`);
        } else {
          messageBus.error(`未知错误: ${String(error)}`);
        }
      } finally {
        setIsProcessing(false);
        messageBus.setThinkingStatus(ThinkingStatus.IDLE);
      }
    },
    [isProcessing, exit, history, showCommandSuggestions, showFileSuggestions]
  );

  // 模型选择回调
  const handleModelSelect = useCallback((model: ModelConfig) => {
    configBus.setCurrentModel(model.id);
    messageBus.createAIMessage();
    messageBus.ai(`✅ 已切换到: ${model.name}`);
    setIsSelectingModel(false);
  }, []);

  // 模型选择取消回调
  const handleModelCancel = useCallback(() => {
    setIsSelectingModel(false);
  }, []);

  // 处理输入变化，检测 "/" 显示命令补全，检测 "@" 显示文件补全
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    
    // 检测是否以 "/" 开头，显示命令补全
    if (value.startsWith("/")) {
      setShowCommandSuggestions(true);
      setShowFileSuggestions(false);
      setCommandSelectedIndex(0);
    } else {
      setShowCommandSuggestions(false);
      
      // 检测 @ 符号，显示文件补全
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
    
    // 重置历史索引
    setHistoryIndex(-1);
  }, []);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {isSelectingModel ? (
        // 模型选择模式（内部管理添加/编辑/删除）
        <ModelSelector
          onSelect={handleModelSelect}
          onCancel={handleModelCancel}
        />
      ) : (
        <>
          {/* 消息列表区域 */}
          <MessageList messages={messages} />

          {/* 命令补全列表 */}
          {showCommandSuggestions && (
            <CommandSuggestions
              selectedIndex={commandSelectedIndex}
              filter={inputValue}
            />
          )}

          {/* 文件补全列表 */}
          {showFileSuggestions && (
            <FileSuggestions
              selectedIndex={fileSelectedIndex}
              filter={fileFilter}
            />
          )}

          {/* 输入框 */}
          <InputBox
            value={inputValue}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            isDisabled={isProcessing}
            inputKey={inputKey}
          />

          {/* 底部提示 */}
          <Box marginTop={1} justifyContent="space-between" paddingX={1}>
            <StatusBar thinkingStatus={thinkingStatus} />
            <Text color="gray" dimColor>
              {/* 输入 exit 或 quit 退出 */}
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
};

export default App;
