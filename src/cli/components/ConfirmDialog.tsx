import React, { useMemo } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

/** 确认对话框组件属性 */
interface Props {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 确认选项值类型 */
type ConfirmValue = "confirm" | "cancel";

/**
 * 确认对话框组件
 * 使用 SelectInput 提供可视化选择，消息文本以卡片形式静态展示
 */
const ConfirmDialog: React.FC<Props> = ({ message, onConfirm, onCancel }) => {
  /** 选择项列表 */
  const items = useMemo(() => [
    { label: "确认", value: "confirm" as ConfirmValue },
    { label: "取消", value: "cancel" as ConfirmValue },
  ], []);

  /** 处理选项选中 */
  const handleSelect = (item: { value: ConfirmValue }) => {
    if (item.value === "confirm") {
      onConfirm();
    } else {
      onCancel();
    }
  };

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="yellow" bold>
        ⚠️ {message}
      </Text>
      <Box marginTop={1}>
        <SelectInput items={items} onSelect={handleSelect} />
      </Box>
    </Box>
  );
};

export default ConfirmDialog;
