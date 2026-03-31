import os from "os";
import React from "react";
import { Box, Text } from "ink";
import BigText from "ink-big-text";
import Gradient from "ink-gradient";
import Markdown from "ink-markdown-es";
import Spinner from "ink-spinner";
import {
  getStatusText,
  formatTotalDuration,
} from "@/core/agent/helpers.ts";
import { ThinkingStatus, type ThinkingState } from "@/core/types.ts";

/** 计划消息卡片属性 */
export interface PlanMessageCardProps {
  /** 计划标题 */
  title: string;
  /** 计划正文 Markdown */
  content: string;
}

/** 计划消息卡片 */
export const PlanMessageCard: React.FC<PlanMessageCardProps> = ({
  title,
  content,
}) => {
  return (
    <Box
      width="100%"
      flexDirection="column"
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
    >
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📋 {title || "计划"}
        </Text>
      </Box>
      <Markdown>{content}</Markdown>
    </Box>
  );
};

/** 状态行组件属性 */
export interface StatusLineProps {
  /** 思考状态 */
  thinkingStatus: ThinkingState;
  /** 运行耗时文本 */
  timerText: string;
}

/** 构建运行中的统一状态栏文案 */
function getRunningText(
  thinkingStatus: ThinkingState,
  timerText: string,
): string {
  const safeStatus = thinkingStatus || {
    status: ThinkingStatus.IDLE,
    detail: "",
  };
  const statusText = getStatusText(safeStatus.status);

  if (!statusText) {
    return "";
  }

  return timerText ? `${statusText}(${timerText})` : statusText;
}

/** 任务运行状态行 */
export const StatusLine: React.FC<StatusLineProps> = ({
  thinkingStatus,
  timerText,
}) => {
  const runningText = getRunningText(thinkingStatus, timerText);

  if (!runningText) {
    return (
      <Box>
        <Text dimColor>{timerText}</Text>
      </Box>
    );
  }

  return (
    <Box>
      <Text color="yellow">
        <Spinner type="dots" /> {runningText}
      </Text>
    </Box>
  );
};

/** 欢迎卡片属性 */
export interface WelcomeCardProps {
  /** 当前使用的模型 ID */
  modelId: string;
  /** 应用版本号 */
  version: string;
  /** 是否存在项目规则文件 */
  hasProjectRules: boolean;
}

/** 将绝对路径中的 home 目录替换为 ~ */
function toTildePath(dir: string): string {
  const home = os.homedir();
  return dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
}

/** 欢迎卡片 */
export const WelcomeCard: React.FC<WelcomeCardProps> = ({
  modelId,
  version,
  hasProjectRules,
}) => {
  const directory = toTildePath(process.cwd());

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginX={1}
      marginTop={1}
      marginBottom={1}
    >
      <Gradient name="rainbow">
        <BigText text="YL CODE" font="block" />
      </Gradient>

      <Box gap={1} marginTop={-1} marginBottom={1}>
        <Text dimColor> YL CODE 编程助手</Text>
        <Text dimColor>{`v${version}`}</Text>
      </Box>

      <Box gap={1}>
        <Text dimColor>当前模型:</Text>
        <Text bold color="cyan">
          {modelId}
        </Text>
      </Box>

      <Box gap={1}>
        <Text dimColor>工作目录:</Text>
        <Text>{directory}</Text>
      </Box>

      {hasProjectRules ? (
        <Box gap={1}>
          <Text dimColor>项目规则:</Text>
          <Text color="yellow">AGENTS.md</Text>
        </Box>
      ) : null}

      <Box gap={1} marginTop={1}>
        <Text dimColor>输入 /model 管理模型</Text>
      </Box>
    </Box>
  );
};

/** 构建统计状态展示文本 */
export function buildMessageTimerText(totalDurationMs?: number): string {
  const durationText =
    typeof totalDurationMs === "number"
      ? formatTotalDuration(totalDurationMs)
      : "0ms";

  if (typeof totalDurationMs === "number") {
    return `总耗时: ${durationText}`;
  }

  return durationText;
}
