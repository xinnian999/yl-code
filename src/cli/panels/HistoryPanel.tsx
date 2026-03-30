import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Text, useInput } from "ink";
import type { Agent } from "@/core/agent/Agent.ts";
import type { SessionMeta } from "@/core/session/session-store.ts";
import ConfirmDialog from "./ConfirmDialog.tsx";
import {
  clampSelectedIndex,
  getNextSelectedIndex,
} from "./list-helpers.ts";
import SelectableList from "./SelectableList.tsx";

/** 内部视图状态 */
type HistoryPanelViewState = "list" | "delete";

/** 历史会话面板属性 */
export interface HistoryPanelProps {
  /** Agent 实例 */
  agent: Agent;
  /** 选择回调 */
  onSelect: (sessionId: string) => void;
  /** 取消回调 */
  onCancel?: () => void;
}

/** 新建会话的特殊标识 */
export const NEW_SESSION_ID = "__new__";

/** 格式化会话列表项文本 */
function formatSessionLabel(session: SessionMeta, currentId: string): string {
  const date = new Date(session.updatedAt);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const timeText = `${month}/${day} ${hours}:${minutes}`;
  const currentTag = session.id === currentId ? " ●" : "";

  return `${session.title}  (${timeText}, ${session.messageCount}条)${currentTag}`;
}

/** 历史会话面板 */
const HistoryPanel: React.FC<HistoryPanelProps> = ({
  agent,
  onSelect,
  onCancel,
}) => {
  const [viewState, setViewState] = useState<HistoryPanelViewState>("list");
  const [deletingSession, setDeletingSession] = useState<SessionMeta | null>(
    null,
  );
  const [selectedIndex, setSelectedIndex] = useState(0);

  const sessions = agent.sessionManager.getSessions();
  const currentId = agent.sessionManager.getCurrentSessionId();

  /** 当前列表项 */
  const items = useMemo(() => {
    return sessions.map((session) => ({
      id: session.id,
      label: formatSessionLabel(session, currentId),
    }));
  }, [currentId, sessions]);

  useEffect(() => {
    setSelectedIndex((currentIndex) => {
      return clampSelectedIndex(currentIndex, sessions.length);
    });
  }, [sessions.length]);

  useInput((input, key) => {
    if (viewState !== "list") {
      return;
    }

    if (key.escape && onCancel) {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setSelectedIndex((currentIndex) => {
        return getNextSelectedIndex(currentIndex, sessions.length, "up");
      });
      return;
    }

    if (key.downArrow) {
      setSelectedIndex((currentIndex) => {
        return getNextSelectedIndex(currentIndex, sessions.length, "down");
      });
      return;
    }

    if (key.return) {
      const session = sessions[selectedIndex];
      if (!session) {
        return;
      }

      if (session.id === currentId) {
        onCancel?.();
        return;
      }

      onSelect(session.id);
      return;
    }

    if (input.toLowerCase() === "n") {
      onSelect(NEW_SESSION_ID);
      return;
    }

    if (input.toLowerCase() !== "d") {
      return;
    }

    const session = sessions[selectedIndex];
    if (!session) {
      return;
    }

    if (session.id === currentId) {
      agent.notify("⚠️ 不能删除当前会话");
      onCancel?.();
      return;
    }

    setDeletingSession(session);
    setViewState("delete");
  });

  /** 确认删除会话 */
  const handleDeleteConfirm = useCallback(() => {
    if (!deletingSession) {
      return;
    }

    agent.sessionManager.deleteSession(deletingSession.id);
    setDeletingSession(null);
    setViewState("list");
  }, [agent, deletingSession]);

  /** 取消删除 */
  const handleDeleteCancel = useCallback(() => {
    setDeletingSession(null);
    setViewState("list");
  }, []);

  if (viewState === "delete" && deletingSession) {
    return (
      <ConfirmDialog
        message={`确认删除会话 "${deletingSession.title}"？`}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />
    );
  }

  return (
    <SelectableList
      title="📋 对话历史 (↑↓ 移动, Enter 确认, Esc 取消)"
      items={items}
      selectedIndex={selectedIndex}
      emptyText="暂无历史对话"
      footer={
        <Text dimColor>
          <Text color="cyan">n</Text> 新建会话 |{" "}
          <Text color="cyan">d</Text> 删除
        </Text>
      }
    />
  );
};

export default HistoryPanel;
