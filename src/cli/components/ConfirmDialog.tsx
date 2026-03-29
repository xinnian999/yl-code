import React from "react";
import { Box, Text, useInput } from "ink";

/** 确认对话框组件属性 */
interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 确认对话框组件
 * 按 y 或 Enter 确认，按 n 或 Esc 取消
 */
const ConfirmDialog: React.FC<Props> = ({ message, onConfirm, onCancel }) => {
  useInput((input, key) => {
    if (input.toLowerCase() === "y" || key.return) {
      onConfirm();
    } else if (input.toLowerCase() === "n" || key.escape) {
      onCancel();
    }
  });

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="yellow" bold>
        ⚠️ {message}
      </Text>
      <Box marginTop={1}>
        <Text dimColor>
          按 <Text color="green" bold>y</Text> 或 <Text color="green" bold>Enter</Text> 确认，按 <Text color="red" bold>n</Text> 或 <Text color="red" bold>Esc</Text> 取消
        </Text>
      </Box>
    </Box>
  );
};

export default ConfirmDialog;
