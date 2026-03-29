import React from "react";
import type { PendingChange } from "@/core/confirm-bus.ts";
import type { EditorType } from "@/core/editor-detector.ts";
import FileDiffConfirm from "./FileDiffConfirm.tsx";
import CommandConfirm from "./CommandConfirm.tsx";

/** 确认卡片组件属性 */
interface DiffConfirmProps {
  /** 待确认的变更信息 */
  change: PendingChange;
  /** 已打开的外部编辑器类型 */
  editorOpened?: EditorType | null;
}

/**
 * 确认卡片路由组件
 * 根据变更类型渲染文件变更确认卡片或命令执行确认卡片（纯展示）
 */
const DiffConfirm: React.FC<DiffConfirmProps> = (props) => {
  if (props.change.type === "command") {
    return <CommandConfirm change={props.change} />;
  }
  return <FileDiffConfirm change={props.change} editorOpened={props.editorOpened} />;
};

export default DiffConfirm;
