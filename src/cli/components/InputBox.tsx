import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { MessageRow } from "./MessageItemChrome.tsx";
import {
  USER_SURFACE_ACCENT_COLOR,
  USER_SURFACE_BACKGROUND_COLOR,
  USER_SURFACE_TEXT_COLOR,
} from "./ChatSurfaceStyles.ts";

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
    <MessageRow>
      <Box width="100%" flexDirection="column" >
        <Box width="100%" paddingX={1} paddingY={1} backgroundColor={USER_SURFACE_BACKGROUND_COLOR}>
          <Text dimColor >
            <Text dimColor>› </Text>
          </Text>
          {isDisabled ? (
            <Text color={USER_SURFACE_TEXT_COLOR} dimColor>请等待响应...按 Esc 中断</Text>
          ) : (
            <TextInput
              key={inputKey}
              value={value}
              onChange={onChange}
              onSubmit={onSubmit}
              placeholder="输入您的指令..."
            />
          )}
        </Box>
      </Box>
    </MessageRow>
  );
};

export default InputBox;
