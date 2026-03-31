import React from "react";
import { Box } from "ink";
import type { Agent } from "@/core/agent/Agent.ts";
import type { ModelConfig } from "@/core/types.ts";
import type { OverlayView } from "../shared/view-state.ts";
import HistoryPanel from "./HistoryPanel.tsx";
import McpPanel from "./McpPanel.tsx";
import ModelPanel from "./ModelPanel.tsx";
import SkillsPanel from "./SkillsPanel.tsx";

/** Overlay 面板内容属性 */
export interface OverlayContentProps {
  /** 当前 overlay 类型 */
  overlayView: OverlayView;
  /** Agent 实例 */
  agent: Agent;
  /** 模型选择回调 */
  onModelSelect: (model: ModelConfig) => void;
  /** 历史会话选择回调 */
  onHistorySelect: (sessionId: string) => void;
  /** 关闭回调 */
  onClose: () => void;
}

/** Overlay 面板内容 */
const OverlayContent: React.FC<OverlayContentProps> = ({
  overlayView,
  agent,
  onModelSelect,
  onHistorySelect,
  onClose,
}) => {
  if (overlayView === "mcp") {
    return (
      <Box paddingX={1}>
        <McpPanel agent={agent} onClose={onClose} />
      </Box>
    );
  }

  if (overlayView === "history") {
    return (
      <Box paddingX={1}>
        <HistoryPanel
          agent={agent}
          onSelect={onHistorySelect}
          onCancel={onClose}
        />
      </Box>
    );
  }

  if (overlayView === "model") {
    return (
      <Box paddingX={1}>
        <ModelPanel
          agent={agent}
          onSelect={onModelSelect}
          onCancel={onClose}
        />
      </Box>
    );
  }

  if (overlayView === "skills") {
    return (
      <Box paddingX={1}>
        <SkillsPanel
          agent={agent}
          onClose={onClose}
        />
      </Box>
    );
  }

  return null;
};

export default OverlayContent;
