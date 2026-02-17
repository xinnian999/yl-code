import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import SelectInput from "ink-select-input";
import type { Agent } from "@/core/agent.ts";
import type { SessionMeta } from "@/core/session/session-store.ts";
import ConfirmDialog from "./ConfirmDialog.tsx";

/** 内部视图状态 */
type ViewState = "list" | "delete";

/** 历史会话选择组件属性 */
interface Props {
  agent: Agent;
  onSelect: (sessionId: string) => void;
  onCancel?: () => void;
}

/** 新建会话的特殊标识 */
export const NEW_SESSION_ID = "__new__";

/**
 * 历史会话选择组件
 * 展示过去的对话历史列表，支持选择切换和删除
 * 快捷键：n 新建会话、d 删除会话、Esc 取消
 */
const HistorySelector: React.FC<Props> = ({ agent, onSelect, onCancel }) => {
  const [viewState, setViewState] = useState<ViewState>("list");
  const [deletingSession, setDeletingSession] = useState<SessionMeta | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const sessions = agent.sessionManager.getSessions();
  const currentId = agent.sessionManager.getCurrentSessionId();

  /** 构建列表项 */
  const items = sessions.map((session) => ({
    label: formatSessionLabel(session, currentId),
    value: session.id,
  }));

  useInput((input, key) => {
    if (viewState !== "list") return;

    if (key.escape && onCancel) {
      onCancel();
      return;
    }

    if (input.toLowerCase() === "n") {
      onSelect(NEW_SESSION_ID);
      return;
    }

    if (input.toLowerCase() === "d") {
      const session = sessions[highlightedIndex];
      if (!session) return;
      if (session.id === currentId) {
        agent.notify("⚠️ 不能删除当前会话");
        onCancel?.();
        return;
      }
      setDeletingSession(session);
      setViewState("delete");
    }
  });

  /** 选中会话 */
  const handleSelect = useCallback(
    (item: { label: string; value: string }) => {
      if (item.value === currentId) {
        onCancel?.();
        return;
      }
      onSelect(item.value);
    },
    [currentId, onSelect, onCancel]
  );

  /** 高亮变化时更新索引 */
  const handleHighlight = useCallback(
    (item: { label: string; value: string }) => {
      const index = sessions.findIndex((s) => s.id === item.value);
      if (index !== -1) setHighlightedIndex(index);
    },
    [sessions]
  );

  /** 确认删除会话 */
  const handleDeleteConfirm = useCallback(() => {
    if (deletingSession) {
      agent.sessionManager.deleteSession(deletingSession.id);
      setDeletingSession(null);
      setViewState("list");
    }
  }, [deletingSession, agent]);

  /** 取消删除 */
  const handleDeleteCancel = useCallback(() => {
    setDeletingSession(null);
    setViewState("list");
  }, []);

  // 删除确认视图
  if (viewState === "delete" && deletingSession) {
    return (
      <ConfirmDialog
        message={`确认删除会话 "${deletingSession.title}"？`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    );
  }

  // 列表视图
  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>
        📋 对话历史 (↑↓ 移动, Enter 确认, Esc 取消)
      </Text>
      <Box
        borderStyle="single"
        borderTop
        borderBottom
        borderLeft={false}
        borderRight={false}
        padding={1}
        marginTop={1}
        marginBottom={1}
      >
        {items.length > 0 ? (
          <SelectInput
            items={items}
            onSelect={handleSelect}
            onHighlight={handleHighlight}
          />
        ) : (
          <Text color="gray">暂无历史对话</Text>
        )}
      </Box>
      <Box>
        <Text color="gray">
          <Text color="cyan">n</Text> 新建会话 |{" "}
          <Text color="cyan">d</Text> 删除
        </Text>
      </Box>
    </Box>
  );
};

/** 格式化会话列表项文本 */
function formatSessionLabel(session: SessionMeta, currentId: string): string {
  const date = new Date(session.updatedAt);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const timeStr = `${month}/${day} ${hours}:${minutes}`;
  const current = session.id === currentId ? " ●" : "";
  return `${session.title}  (${timeStr}, ${session.messageCount}条)${current}`;
}

export default HistorySelector;
