import React from "react";
import { Box, Text, useStdout } from "ink";
import {
  USER_SURFACE_ACCENT_COLOR,
  USER_SURFACE_BACKGROUND_COLOR,
  USER_SURFACE_TEXT_COLOR,
} from "./ChatSurfaceStyles.ts";

/** 消息区块左右内边距 */
const MESSAGE_SIDE_PADDING = 2;

/** 计算当前终端可用消息宽度 */
function useMessageWidth(): number {
  const { stdout } = useStdout();
  return Math.max(20, (stdout.columns || 80) - MESSAGE_SIDE_PADDING);
}

/** 通用消息行属性 */
interface MessageRowProps {
  /** 行内子内容 */
  children: React.ReactNode;
}

/** 通用消息行容器 */
export const MessageRow: React.FC<MessageRowProps> = ({ children }) => {
  const messageWidth = useMessageWidth();

  return (
    <Box width={messageWidth} flexDirection="column" marginBottom={1}>
      {children}
    </Box>
  );
};

/** 助手消息区块属性 */
interface AssistantSectionProps {
  /** 区块内容 */
  children: React.ReactNode;
}

/** 助手消息区块 */
export const AssistantSection: React.FC<AssistantSectionProps> = ({ children }) => {
  const messageWidth = useMessageWidth();

  return (
    <MessageRow>
      <Box width={messageWidth} flexDirection="column" paddingX={1}>
        {children}
      </Box>
    </MessageRow>
  );
};

/** 用户消息气泡属性 */
interface UserBubbleProps {
  /** 用户消息文本 */
  content: string;
}

/** 用户消息气泡 */
export const UserBubble: React.FC<UserBubbleProps> = ({ content }) => {
  const messageWidth = useMessageWidth();

  return (
    <MessageRow>
      <Box width={messageWidth} flexDirection="column" >
        <Box
          width="100%"
          paddingX={1}
          paddingY={1}
          backgroundColor={USER_SURFACE_BACKGROUND_COLOR}
        >
          <Text color={USER_SURFACE_TEXT_COLOR}>
            <Text color={USER_SURFACE_ACCENT_COLOR}>› </Text>
            {content}
          </Text>
        </Box>
      </Box>
    </MessageRow>
  );
};

/** 调试信息属性 */
interface DebugInfoProps {
  /** 调试文本 */
  debug: string;
}

/** 调试信息面板 */
export const DebugInfo: React.FC<DebugInfoProps> = ({ debug }) => {
  const messageWidth = useMessageWidth();

  return (
    <Box
      width={messageWidth}
      marginTop={0}
      marginBottom={1}
      paddingX={1}
      borderStyle="single"
      borderColor="magenta"
      flexDirection="column"
    >
      <Text color="magenta" bold>{"🐛 DEBUG"}</Text>
      <Text color="magenta" dimColor>{debug}</Text>
    </Box>
  );
};
