import React from "react";
import { Box, Text } from "ink";
import Markdown from "ink-markdown-es";

/** 计划消息块属性 */
interface PlanMessageBlockProps {
  /** 计划标题 */
  title: string;
  /** 计划正文 Markdown */
  content: string;
}

/**
 * 计划消息块
 * 使用独立边框承载完整计划，便于在消息流中快速识别
 */
const PlanMessageBlock: React.FC<PlanMessageBlockProps> = ({
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

export default PlanMessageBlock;
