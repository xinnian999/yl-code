import { useState, useEffect } from "react";
import type { ContextUsage } from "@/core/types.ts";
import type { Agent } from "@/core/agent.ts";

/**
 * 上下文使用量状态管理 hook
 * 订阅 agent.contextBus 事件，实时更新上下文使用百分比
 */
export function useContextUsage(agent: Agent) {
  const [usage, setUsage] = useState<ContextUsage>(
    () => agent.contextBus.getUsage()
  );
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    const { contextBus } = agent;

    /** 使用量更新 */
    const handleUpdate = (newUsage: ContextUsage) => {
      setUsage(newUsage);
    };

    /** 开始压缩 */
    const handleSummarizing = () => {
      setIsSummarizing(true);
    };

    /** 压缩完成 */
    const handleSummarized = (newUsage: ContextUsage) => {
      setIsSummarizing(false);
      setUsage(newUsage);
    };

    contextBus.on("context:update", handleUpdate);
    contextBus.on("context:summarizing", handleSummarizing);
    contextBus.on("context:summarized", handleSummarized);

    return () => {
      contextBus.off("context:update", handleUpdate);
      contextBus.off("context:summarizing", handleSummarizing);
      contextBus.off("context:summarized", handleSummarized);
    };
  }, [agent]);

  return { usage, isSummarizing };
}
