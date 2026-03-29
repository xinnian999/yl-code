import React, { useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { ScrollList } from "ink-scroll-list";
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

/** 可滚动列表的最大可见高度 */
const LIST_HEIGHT = 12;

/**
 * 历史会话选择组件
 * 展示过去的对话历史列表，支持选择切换和删除
 * 快捷键：n 新建会话、d 删除会话、Esc 取消
 */
const HistorySelector: React.FC<Props> = ({ agent, onSelect, onCancel }) => {
  const [viewState, setViewState] = useState<ViewState>("list");
  const [deletingSession, setDeletingSession] = useState<SessionMeta | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const sessions = agent.sessionManager.getSessions();
  const currentId = agent.sessionManager.getCurrentSessionId();

  useInput((input, key) => {
    if (viewState !== "list") return;

    if (key.escape && onCancel) {
      onCancel();
      return;
    }

    // 上下键导航
    if (key.upArrow) {
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((prev) => Math.min(prev + 1, sessions.length - 1));
      return;
    }

    // Enter 确认选中
    if (key.return) {
      const session = sessions[selectedIndex];
      if (!session) return;
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

    if (input.toLowerCase() === "d") {
      const session = sessions[selectedIndex];
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
        marginTop={1}
        marginBottom={1}
        height={LIST_HEIGHT}
      >
        {sessions.length > 0 ? (
          <ScrollList selectedIndex={selectedIndex}>
            {sessions.map((session, i) => (
              <Box key={session.id} paddingX={1}>
                <Text color={i === selectedIndex ? "green" : ""}>
                  {i === selectedIndex ? "> " : "  "}
                  {formatSessionLabel(session, currentId)}
                </Text>
              </Box>
            ))}
          </ScrollList>
        ) : (
          <Text dimColor>暂无历史对话</Text>
        )}
      </Box>
      <Box>
        <Text dimColor>
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
