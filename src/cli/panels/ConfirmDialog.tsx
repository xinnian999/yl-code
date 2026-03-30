import React, { useMemo } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";

/** 确认对话框属性 */
export interface ConfirmDialogProps {
  /** 提示消息 */
  message: string;
  /** 确认回调 */
  onConfirm: () => void;
  /** 取消回调 */
  onCancel: () => void;
}

/** 确认选项值类型 */
type ConfirmValue = "confirm" | "cancel";

/** 确认对话框 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  message,
  onConfirm,
  onCancel,
}) => {
  /** 选择项列表 */
  const items = useMemo(() => {
    return [
      { label: "确认", value: "confirm" as ConfirmValue },
      { label: "取消", value: "cancel" as ConfirmValue },
    ];
  }, []);

  /** 处理选项选中 */
  const handleSelect = (item: { value: ConfirmValue }) => {
    if (item.value === "confirm") {
      onConfirm();
      return;
    }

    onCancel();
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
