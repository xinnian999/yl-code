import React from "react";
import { Box, Text } from "ink";
import os from "os";

/** WelcomeCard 组件属性 */
interface WelcomeCardProps {
  /** 当前使用的模型 ID */
  modelId: string;
  /** 应用版本号 */
  version: string;
}

/** 将绝对路径中的 home 目录替换为 ~ */
function toTildePath(dir: string): string {
  const home = os.homedir();
  return dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir;
}

/**
 * 欢迎卡片组件
 * 在没有对话消息时展示，类似 OpenAI Codex CLI 的启动界面
 */
const WelcomeCard: React.FC<WelcomeCardProps> = ({ modelId, version }) => {
  const directory = toTildePath(process.cwd());

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      marginX={1}
      marginTop={1}
      marginBottom={1}
    >
      {/* 标题行 */}
      <Text bold>{`>_ 牛码 (v${version})`}</Text>

      <Box height={1} />

      {/* model 行 */}
      <Box gap={1}>
        <Text color="gray">{"model:    "}</Text>
        <Text bold color="cyan">{modelId}</Text>
        <Text color="gray">  /model to change</Text>
      </Box>

      {/* directory 行 */}
      <Box gap={1}>
        <Text color="gray">{"directory:"}</Text>
        <Text>{directory}</Text>
      </Box>
    </Box>
  );
};

export default WelcomeCard;
