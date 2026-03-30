import React from "react";
import { Text } from "ink";
import type { SelectableListItem } from "./SelectableList.tsx";
import SelectableList from "./SelectableList.tsx";

/** 模型列表视图属性 */
export interface ModelListViewProps {
  /** 列表项 */
  items: SelectableListItem[];
  /** 当前选中索引 */
  selectedIndex: number;
  /** 当前是否选中内置模型 */
  isBuiltinSelected: boolean;
}

/** 模型列表视图 */
const ModelListView: React.FC<ModelListViewProps> = ({
  items,
  selectedIndex,
  isBuiltinSelected,
}) => {
  return (
    <SelectableList
      title="🔧 选择模型 (↑↓ 移动, Enter 确认, Esc 取消)"
      items={items}
      selectedIndex={selectedIndex}
      emptyText="暂无可用模型"
      footer={
        <Text dimColor>
          <Text color="cyan">a</Text> 添加
          {!isBuiltinSelected ? (
            <>
              {" | "}
              <Text color="cyan">c</Text> 复制
              {" | "}
              <Text color="cyan">e</Text> 编辑
              {" | "}
              <Text color="cyan">d</Text> 删除
            </>
          ) : null}
        </Text>
      }
    />
  );
};

export default ModelListView;
