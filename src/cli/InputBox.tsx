import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface InputBoxProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  isDisabled: boolean;
}

/**
 * 输入框组件
 * 用于接收用户输入
 */
const InputBox: React.FC<InputBoxProps> = ({ value, onChange, onSubmit, isDisabled }) => {
  return (
    <Box borderStyle="single" borderColor="cyan" paddingX={1}>
      <Text color="cyan">❯ </Text>
      <TextInput
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        placeholder={isDisabled ? "请等待响应..." : "输入您的问题..."}
      />
    </Box>
  );
};

export default InputBox;
