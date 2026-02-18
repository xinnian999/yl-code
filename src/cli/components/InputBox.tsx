import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

/** 输入框组件属性 */
interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isDisabled: boolean;
  inputKey?: number; // 用于强制重新挂载 TextInput，重置光标位置
}

/**
 * 输入框组件
 * 禁用时卸载 TextInput，彻底避免输入事件处理开销
 */
const InputBox: React.FC<InputBoxProps> = ({ value, onChange, onSubmit, isDisabled, inputKey = 0 }) => {
  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1} marginLeft={1}>
      <Text color="cyan">❯ </Text>
      {isDisabled ? (
        <Text dimColor>请等待响应...按 Esc 中断</Text>
      ) : (
        <TextInput
          key={inputKey}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="输入您的问题..."
        />
      )}
    </Box>
  );
};

export default InputBox;
