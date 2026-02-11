import React, { useState, useEffect, useCallback } from "react";
import { Box, Text, useApp, useInput } from "ink";
import MessageList from "./MessageList.tsx";
import InputBox from "./InputBox.tsx";
import StatusBar from "./StatusBar.tsx";
import ModelSelector from "./ModelSelector.tsx";
import ModelForm, { type ModelFormData } from "./ModelForm.tsx";
import ConfirmDialog from "./ConfirmDialog.tsx";
import CommandSuggestions from "./CommandSuggestions.tsx";
import { commands } from "./commands.ts";
import messageBus, { ThinkingStatus, type Message, type ThinkingState } from "@/utils/message-bus.ts";
import configBus, { type ModelConfig } from "@/utils/config-bus.ts";
import run, { clearMemory } from "@/core/run.ts";
import { cleanup } from "@/utils/process-manager.ts";
import { loadHistory, addToHistory } from "@/utils/history.ts";

const welcomeMessage = `您好老板！

我是您的专属 🐂 牛码 🐎 ；

我擅长写代码、改BUG等；

我喜欢干各种关于代码的脏活累活；

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

  // 模型管理状态
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [isEditingModel, setIsEditingModel] = useState(false);
  const [isDeletingModel, setIsDeletingModel] = useState(false);
  const [editingModel, setEditingModel] = useState<ModelConfig | null>(null);
  const [deletingModel, setDeletingModel] = useState<ModelConfig | null>(null);

  // 命令选择状态
  const [showCommandSuggestions, setShowCommandSuggestions] = useState(false);
  const [commandSelectedIndex, setCommandSelectedIndex] = useState(0);

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
- 按 Ctrl+C 强制退出`);
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

  // 处理键盘输入（退出 + 历史命令切换 + 命令补全选择）
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      cleanup();
      exit();
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

    // 上下键切换历史命令（非命令补全模式）
    if (!isProcessing && !showCommandSuggestions && history.length > 0) {
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
      // 如果处于命令补全模式，不处理提交（由 useInput 处理）
      if (showCommandSuggestions) {
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

      // 显示用户消息
      messageBus.user(trimmedValue);

      try {
        await run(trimmedValue);
      } catch (error) {
        // 确保有一个 AI 消息来承载错误
        messageBus.createAIMessage();
        const err = error as Error;
        if (err) {
          messageBus.error(`错误: ${err.message || String(error)}`);
          if (err.stack) {
            messageBus.error(`堆栈跟踪:\n${err.stack}`);
          }

          if (err.message && err.message.includes("pass an `apiKey`")) {
            messageBus.error(`未配置 API_KEY`);
          }
        } else {
          messageBus.error(`未知错误: ${String(error)}`);
        }
      } finally {
        setIsProcessing(false);
        messageBus.setThinkingStatus(ThinkingStatus.IDLE);
      }
    },
    [isProcessing, exit, history, showCommandSuggestions]
  );

  // 模型选择回调
  const handleModelSelect = useCallback((model: ModelConfig) => {
    configBus.setCurrentModel(model.id);
    // clearMemory();
    messageBus.createAIMessage();
    messageBus.ai(`✅ 已切换到: ${model.name}`);
    setIsSelectingModel(false);
  }, []);

  // 模型选择取消回调
  const handleModelCancel = useCallback(() => {
    setIsSelectingModel(false);
  }, []);

  // 添加模型回调
  const handleAddModel = useCallback(() => {
    setIsSelectingModel(false);
    setIsAddingModel(true);
  }, []);

  // 编辑模型回调
  const handleEditModel = useCallback((model: ModelConfig) => {
    setIsSelectingModel(false);
    setEditingModel(model);
    setIsEditingModel(true);
  }, []);

  // 删除模型回调
  const handleDeleteModel = useCallback((model: ModelConfig) => {
    // 不能删除当前正在使用的模型
    if (model.id === configBus.getCurrentModelId()) {
      messageBus.createAIMessage();
      messageBus.ai("⚠️ 不能删除当前正在使用的模型，请先切换到其他模型");
      setIsSelectingModel(false);
      return;
    }
    setIsSelectingModel(false);
    setDeletingModel(model);
    setIsDeletingModel(true);
  }, []);

  // 模型表单提交回调
  const handleModelFormSubmit = useCallback((data: ModelFormData) => {
    if (isAddingModel) {
      // 添加新模型
      const newModel: ModelConfig = {
        id: `model_${Date.now()}`,
        name: data.name,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey,
        modelName: data.modelName,
      };
      configBus.addModel(newModel);
      configBus.setCurrentModel(newModel.id);
      messageBus.createAIMessage();
      messageBus.ai(`✅ 模型 "${data.name}" 添加成功，已自动切换`);
      setIsAddingModel(false);
    } else if (isEditingModel && editingModel) {
      // 更新现有模型
      configBus.updateModel(editingModel.id, {
        name: data.name,
        baseUrl: data.baseUrl,
        apiKey: data.apiKey,
        modelName: data.modelName,
      });
      messageBus.createAIMessage();
      messageBus.ai(`✅ 模型 "${data.name}" 更新成功`);
      setIsEditingModel(false);
      setEditingModel(null);
    }
  }, [isAddingModel, isEditingModel, editingModel]);

  // 模型表单取消回调
  const handleModelFormCancel = useCallback(() => {
    setIsAddingModel(false);
    setIsEditingModel(false);
    setEditingModel(null);
    setIsSelectingModel(true);
  }, []);

  // 删除确认回调
  const handleDeleteConfirm = useCallback(() => {
    if (deletingModel) {
      configBus.removeModel(deletingModel.id);
      messageBus.createAIMessage();
      messageBus.ai(`✅ 模型 "${deletingModel.name}" 已删除`);
      setIsDeletingModel(false);
      setDeletingModel(null);
    }
  }, [deletingModel]);

  // 删除取消回调
  const handleDeleteCancel = useCallback(() => {
    setIsDeletingModel(false);
    setDeletingModel(null);
    setIsSelectingModel(true);
  }, []);

  // 处理输入变化，检测 "/" 显示命令补全
  const handleInputChange = useCallback((value: string) => {
    setInputValue(value);
    
    // 检测是否以 "/" 开头，显示命令补全
    if (value.startsWith("/")) {
      setShowCommandSuggestions(true);
      // 重置选中索引
      setCommandSelectedIndex(0);
    } else {
      setShowCommandSuggestions(false);
    }
    
    // 重置历史索引
    setHistoryIndex(-1);
  }, []);

  return (
    <Box flexDirection="column" height="100%" padding={1}>
      {isAddingModel ? (
        // 添加模型表单
        <ModelForm
          mode="add"
          onSubmit={handleModelFormSubmit}
          onCancel={handleModelFormCancel}
        />
      ) : isEditingModel && editingModel ? (
        // 编辑模型表单
        <ModelForm
          mode="edit"
          initialValues={{
            name: editingModel.name,
            baseUrl: editingModel.baseUrl,
            apiKey: editingModel.apiKey,
            modelName: editingModel.modelName,
          }}
          onSubmit={handleModelFormSubmit}
          onCancel={handleModelFormCancel}
        />
      ) : isDeletingModel && deletingModel ? (
        // 删除确认对话框
        <ConfirmDialog
          message={`确认删除模型 "${deletingModel.name}"？`}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      ) : isSelectingModel ? (
        // 模型选择模式
        <ModelSelector
          onSelect={handleModelSelect}
          onCancel={handleModelCancel}
          onAddModel={handleAddModel}
          onEditModel={handleEditModel}
          onDeleteModel={handleDeleteModel}
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

          {/* 输入框 */}
          <InputBox
            value={inputValue}
            onChange={handleInputChange}
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
        </>
      )}
    </Box>
  );
};

export default App;
