import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { FileItem } from "@/core/file-scanner.ts";
import type { SkillIndexEntry } from "@/core/skills/index.ts";
import { MessageRow } from "../shared/MessageChrome.tsx";
import {
  USER_SURFACE_ACCENT_COLOR,
  USER_SURFACE_BACKGROUND_COLOR,
  USER_SURFACE_TEXT_COLOR,
} from "../shared/ChatSurfaceStyles.ts";
import {
  CommandSuggestions,
  FileSuggestions,
  SkillSuggestions,
} from "./ComposerSuggestions.tsx";

/** 输入框属性 */
export interface InputBoxProps {
  /** 当前输入值 */
  value: string;
  /** 输入变化回调 */
  onChange: (value: string) => void;
  /** 提交回调 */
  onSubmit: (value: string) => void;
  /** 是否禁用 */
  isDisabled: boolean;
  /** 用于强制重置输入组件 */
  inputKey?: number;
}

/** 输入框 */
const InputBox: React.FC<InputBoxProps> = ({
  value,
  onChange,
  onSubmit,
  isDisabled,
  inputKey = 0,
}) => {
  return (
    <MessageRow>
      <Box
        width="100%"
        paddingX={1}
        paddingY={1}
        backgroundColor={USER_SURFACE_BACKGROUND_COLOR}
      >
        <Text dimColor>
          <Text color={USER_SURFACE_ACCENT_COLOR}>› </Text>
        </Text>
        {isDisabled ? (
          <Text color={USER_SURFACE_TEXT_COLOR} dimColor>
            请等待响应...按 Esc 中断
          </Text>
        ) : (
          <TextInput
            key={inputKey}
            value={value}
            onChange={onChange}
            onSubmit={onSubmit}
            placeholder="请输入你的需求..."
          />
        )}
      </Box>
    </MessageRow>
  );
};

/** 组合输入区属性 */
export interface ComposerInputProps {
  /** 当前输入值 */
  value: string;
  /** 输入变化回调 */
  onChange: (value: string) => void;
  /** 提交回调 */
  onSubmit: (value: string) => void;
  /** 是否禁用 */
  isDisabled: boolean;
  /** 输入框重置 key */
  inputKey: number;
  /** 是否显示命令建议 */
  showCommandSuggestions: boolean;
  /** 命令建议列表 */
  commandItems: Array<{ value: string; description: string }>;
  /** 命令建议选中索引 */
  commandSelectedIndex: number;
  /** 是否显示文件建议 */
  showFileSuggestions: boolean;
  /** 文件建议列表 */
  fileItems: FileItem[];
  /** 文件建议选中索引 */
  fileSelectedIndex: number;
  /** 当前文件过滤词 */
  fileFilter: string;
  /** 是否显示技能建议 */
  showSkillSuggestions: boolean;
  /** 技能建议列表 */
  skillItems: SkillIndexEntry[];
  /** 技能建议选中索引 */
  skillSelectedIndex: number;
}

/** 组合输入区 */
const ComposerInput: React.FC<ComposerInputProps> = ({
  value,
  onChange,
  onSubmit,
  isDisabled,
  inputKey,
  showCommandSuggestions,
  commandItems,
  commandSelectedIndex,
  showFileSuggestions,
  fileItems,
  fileSelectedIndex,
  fileFilter,
  showSkillSuggestions,
  skillItems,
  skillSelectedIndex,
}) => {
  return (
    <>
      {showCommandSuggestions ? (
        <CommandSuggestions
          commands={commandItems}
          selectedIndex={commandSelectedIndex}
        />
      ) : null}
      {showFileSuggestions ? (
        <FileSuggestions
          files={fileItems}
          selectedIndex={fileSelectedIndex}
          filter={fileFilter}
        />
      ) : null}
      {showSkillSuggestions ? (
        <SkillSuggestions
          skills={skillItems}
          selectedIndex={skillSelectedIndex}
        />
      ) : null}
      <InputBox
        value={value}
        onChange={onChange}
        onSubmit={onSubmit}
        isDisabled={isDisabled}
        inputKey={inputKey}
      />
    </>
  );
};

export default ComposerInput;
