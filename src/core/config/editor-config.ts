/** 支持的编辑器类型 */
export type EditorType = "trae" | "cursor" | "code" | "idea" | "webstorm" | "nvim";

/** 编辑器运行配置 */
export interface EditorConfig {
  /** 启动命令 */
  cmd: string;
  /** 人类可读名称 */
  name: string;
  /** diff 参数生成器 */
  diffArgs: (file1: string, file2: string) => string[];
}

/** 编辑器配置表 */
export const EDITORS: Record<EditorType, EditorConfig> = {
  trae: {
    cmd: "trae",
    name: "Trae",
    diffArgs: (file1, file2) => ["--diff", file1, file2],
  },
  cursor: {
    cmd: "cursor",
    name: "Cursor",
    diffArgs: (file1, file2) => ["--diff", file1, file2],
  },
  code: {
    cmd: "code",
    name: "VS Code",
    diffArgs: (file1, file2) => ["--diff", file1, file2],
  },
  idea: {
    cmd: "idea",
    name: "IntelliJ IDEA",
    diffArgs: (file1, file2) => ["diff", file1, file2],
  },
  webstorm: {
    cmd: "webstorm",
    name: "WebStorm",
    diffArgs: (file1, file2) => ["diff", file1, file2],
  },
  nvim: {
    cmd: "nvim",
    name: "Neovim",
    diffArgs: (file1, file2) => ["-d", file1, file2],
  },
};

/** 进程树向上追溯最大深度 */
export const PROCESS_TREE_MAX_DEPTH = 8;

/** diff 临时目录名称 */
export const DIFF_TEMP_DIR_NAME = "niu-code-diff";

/** 终端编辑器白名单 */
export const TERMINAL_EDITOR_COMMANDS: string[] = ["vi", "vim", "nvim", "nano", "emacs"];
