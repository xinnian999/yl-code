import React, { useMemo } from "react";
import { Box, Text } from "ink";
import SelectInput from "ink-select-input";
import type { ConfirmResult } from "@/core/types.ts";
import type {
  PlanPreviewResult,
  PlanQuestionAnswer,
} from "@/core/plan/plan-bus.ts";
import { USER_SURFACE_BACKGROUND_COLOR } from "../shared/ChatSurfaceStyles.ts";
import type { ActiveConfirm } from "./active-confirm.ts";
import PlanQuestionSelect from "./PlanQuestionSelect.tsx";

/** 底部确认条属性 */
export interface ConfirmBarProps {
  /** 当前激活的确认态 */
  activeConfirm: ActiveConfirm;
  /** diff 确认回调 */
  onDiffConfirm: (result: ConfirmResult) => void;
  /** 计划问题回答回调 */
  onPlanQuestionResolve: (answer: PlanQuestionAnswer) => void;
  /** 计划预览结果回调 */
  onPlanPreviewResolve: (result: PlanPreviewResult) => void;
}

/** diff 确认固定选项值类型 */
type DiffAction = ConfirmResult;

/** 计划预览操作值类型 */
type PlanPreviewAction = "execute" | "revise";

/** 底部确认条 */
const ConfirmBar: React.FC<ConfirmBarProps> = ({
  activeConfirm,
  onDiffConfirm,
  onPlanQuestionResolve,
  onPlanPreviewResolve,
}) => {
  /** diff/命令确认选项 */
  const diffItems = useMemo(() => {
    return [
      { label: "同意", value: "accept" as DiffAction },
      { label: "同意且不再询问", value: "accept_all" as DiffAction },
      { label: "拒绝", value: "reject" as DiffAction },
    ];
  }, []);

  /** 计划预览选项 */
  const planPreviewItems = useMemo(() => {
    return [
      { label: "确认执行", value: "execute" as PlanPreviewAction },
      { label: "修改计划", value: "revise" as PlanPreviewAction },
    ];
  }, []);

  if (activeConfirm.kind === "diff") {
    return (
      <Box
        paddingX={2}
        paddingY={1}
        backgroundColor={USER_SURFACE_BACKGROUND_COLOR}
        width="100%"
        flexDirection="column"
      >
        <Box marginBottom={1}>
          <Text dimColor>同意上述操作吗？</Text>
        </Box>
        <SelectInput
          items={diffItems}
          onSelect={(item) => onDiffConfirm(item.value)}
        />
      </Box>
    );
  }

  if (activeConfirm.kind === "plan_preview") {
    return (
      <Box
        paddingX={2}
        paddingY={1}
        backgroundColor={USER_SURFACE_BACKGROUND_COLOR}
        width="100%"
        flexDirection="column"
      >
        <Box flexDirection="column" paddingX={1} marginBottom={1}>
          <Text bold>{`已生成最终计划：${activeConfirm.interaction.title}`}</Text>
          <Text dimColor>完整计划已在上方消息区静态渲染。</Text>
          <Text dimColor>
            确认执行会直接开始实现；选择修改计划后，会恢复输入框供你继续补充要求。
          </Text>
        </Box>
        <SelectInput
          items={planPreviewItems}
          onSelect={(item) => onPlanPreviewResolve({ action: item.value })}
        />
      </Box>
    );
  }

  if (activeConfirm.kind === "plan_question") {
    return (
      <Box
        paddingX={2}
        paddingY={1}
        backgroundColor={USER_SURFACE_BACKGROUND_COLOR}
        width="100%"
        flexDirection="column"
      >
        <PlanQuestionSelect
          interaction={activeConfirm.interaction}
          onResolve={onPlanQuestionResolve}
        />
      </Box>
    );
  }

  return null;
};

export default ConfirmBar;
