import { useEffect, useState } from "react";
import type { Agent } from "@/core/agent/Agent.ts";
import type { ContextUsage } from "@/core/types.ts";

/** 上下文使用量订阅结果 */
export interface UseContextUsageResult {
  /** 当前使用量 */
  usage: ContextUsage;
  /** 是否正在压缩 */
  isSummarizing: boolean;
}

/** 上下文使用量状态管理 hook */
export function useContextUsage(agent: Agent): UseContextUsageResult {
  const [usage, setUsage] = useState<ContextUsage>(() => {
    return agent.contextBus.getUsage();
  });
  const [isSummarizing, setIsSummarizing] = useState(false);

  useEffect(() => {
    /** 处理使用量更新 */
    const handleUpdate = (nextUsage: ContextUsage) => {
      setUsage(nextUsage);
    };

    /** 处理开始压缩 */
    const handleSummarizing = () => {
      setIsSummarizing(true);
    };

    /** 处理压缩完成 */
    const handleSummarized = (nextUsage: ContextUsage) => {
      setIsSummarizing(false);
      setUsage(nextUsage);
    };

    agent.contextBus.on("context:update", handleUpdate);
    agent.contextBus.on("context:summarizing", handleSummarizing);
    agent.contextBus.on("context:summarized", handleSummarized);

    return () => {
      agent.contextBus.off("context:update", handleUpdate);
      agent.contextBus.off("context:summarizing", handleSummarizing);
      agent.contextBus.off("context:summarized", handleSummarized);
    };
  }, [agent]);

  return { usage, isSummarizing };
}
