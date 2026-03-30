import React from "react";
import { Box, Text } from "ink";
import { ScrollList } from "ink-scroll-list";

/** 选择列表项 */
export interface SelectableListItem {
  /** 唯一 ID */
  id: string;
  /** 展示文案 */
  label: string;
}

/** 选择列表属性 */
export interface SelectableListProps {
  /** 标题 */
  title: string;
  /** 列表项 */
  items: SelectableListItem[];
  /** 当前选中索引 */
  selectedIndex: number;
  /** 空态文案 */
  emptyText: string;
  /** 底部内容 */
  footer?: React.ReactNode;
  /** 列表高度 */
  height?: number;
}

/** 通用可选列表 */
const SelectableList: React.FC<SelectableListProps> = ({
  title,
  items,
  selectedIndex,
  emptyText,
  footer,
  height = 12,
}) => {
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>
        {title}
      </Text>
      <Box
        borderStyle="single"
        borderTop
        borderBottom
        borderLeft={false}
        borderRight={false}
        marginTop={1}
        marginBottom={1}
        height={height}
      >
        {items.length > 0 ? (
          <ScrollList selectedIndex={selectedIndex}>
            {items.map((item, index) => {
              const isSelected = index === selectedIndex;

              return (
                <Box key={item.id} paddingX={1}>
                  <Text color={isSelected ? "green" : undefined}>
                    {isSelected ? "> " : "  "}
                    {item.label}
                  </Text>
                </Box>
              );
            })}
          </ScrollList>
        ) : (
          <Text dimColor>{emptyText}</Text>
        )}
      </Box>
      {footer ? <Box>{footer}</Box> : null}
    </Box>
  );
};

export default SelectableList;
