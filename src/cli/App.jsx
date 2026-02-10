import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import MessageList from "./MessageList.jsx";
import InputBox from "./InputBox.jsx";
import StatusBar from "./StatusBar.jsx";
import messageBus, { ThinkingStatus } from "@/utils/message-bus.js";
import run from "@/core/run.js";
import { cleanup } from "@/utils/process-manager.js";
import { loadHistory, addToHistory } from "@/utils/history.js";

const welcomeMessage = `您好老板！

我是您的专属 🐂 牛码 🐎 ；

我擅长写代码、改BUG等；

我喜欢干各种关于代码的脏活累活；

有什么可以为您效劳的？😊`;

/**
 * 主应用组件
 */
const App = () => {
  const { exit } = useApp();
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [thinkingStatus, setThinkingStatus] = useState({
    status: ThinkingStatus.IDLE,
    detail: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);

  // 历史命令相关状态
  const [history, setHistory] = useState(() => loadHistory()); // 从文件加载历史
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [tempInput, setTempInput] = useState(""); // 保存当前输入（用于从历史返回时恢复）

  // 订阅消息总线
  useEffect(() => {
    const handleMessage = (message) => {
      setMessages((prev) => [...prev, message]);
    };

    const handleMessageUpdate = (updatedMessage) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === updatedMessage.id ? { ...updatedMessage } : msg
        )
      );
    };

    const handleThinking = (status) => {
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

  // 处理键盘输入（退出 + 历史命令切换）
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      cleanup();
      exit();
    }

    // 上下键切换历史命令
    if (!isProcessing && history.length > 0) {
      if (key.upArrow) {
        if (historyIndex === -1) {
          // 首次按上键，保存当前输入
          setTempInput(inputValue);
          setHistoryIndex(history.length - 1);
          setInputValue(history[history.length - 1]);
        } else if (historyIndex > 0) {
          // 继续往上翻
          setHistoryIndex(historyIndex - 1);
          setInputValue(history[historyIndex - 1]);
        }
      }

      if (key.downArrow) {
        if (historyIndex !== -1) {
          if (historyIndex < history.length - 1) {
            // 往下翻
            setHistoryIndex(historyIndex + 1);
            setInputValue(history[historyIndex + 1]);
          } else {
            // 到底了，恢复临时输入
            setHistoryIndex(-1);
            setInputValue(tempInput);
          }
        }
      }
    }
  });

  // 处理用户输入提交
  const handleSubmit = useCallback(
    async (value) => {
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

      // 显示用户消息
      messageBus.user(trimmedValue);

      try {
        await run(trimmedValue);
      } catch (error) {
        // 确保有一个 AI 消息来承载错误
        messageBus.createAIMessage();
        if (error) {
          messageBus.error(`错误: ${error.message || String(error)}`);
          if (error.stack) {
            messageBus.error(`堆栈跟踪:\n${error.stack}`);
          }

          if (error.message && error.message.includes("pass an `apiKey`")) {
            messageBus.error(`未配置 API_KEY`);
          }
        } else {
          messageBus.error(`未知错误: ${String(error)}`);
        }
        messageBus.endAIMessage();
      } finally {
        setIsProcessing(false);
        messageBus.setThinkingStatus(ThinkingStatus.IDLE);
      }
    },
    [isProcessing, exit, history]
  );

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {/* 消息列表区域 */}
      <MessageList messages={messages} />



      {/* 输入框 */}
      <InputBox
        value={inputValue}
        onChange={setInputValue}
        onSubmit={handleSubmit}
        isDisabled={isProcessing}
      />

      {/* 底部提示 */}
      <Box marginTop={1} justifyContent="space-between" paddingX={1}>
        <StatusBar thinkingStatus={thinkingStatus} />
        <Text color="gray" dimColor>
          {/* 输入 exit 或 quit 退出 */}
        </Text>
      </Box>
    </Box>
  );
};

export default App;
