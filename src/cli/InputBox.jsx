import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

/**
 * 输入框组件
 * 用于接收用户输入
 */
const InputBox = ({ value, onChange, onSubmit, isDisabled }) => {
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
