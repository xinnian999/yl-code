/** 文件扫描时忽略的目录和文件 */
export const FILE_SCANNER_IGNORED_PATTERNS: string[] = [
  "node_modules",
  ".git",
  ".DS_Store",
  "dist",
  "build",
  ".next",
  ".cache",
  "coverage",
];

/** 文件扫描缓存时长（毫秒） */
export const FILE_SCANNER_CACHE_TTL_MS = 5000;

/** 文件补全结果最大数量 */
export const FILE_SUGGESTION_MAX_RESULTS = 50;

/** 读取文件内容时的最大字节数 */
export const FILE_CONTENT_MAX_SIZE = 100 * 1024;

/** 目录树默认展示深度 */
export const DIRECTORY_TREE_MAX_DEPTH = 2;

/** 文件匹配打分配置 */
export const FILE_MATCH_SCORE = {
  EXACT_NAME: 1000,
  NAME_PREFIX: 800,
  NAME_CONTAINS: 600,
  PATH_PREFIX: 400,
  PATH_CONTAINS: 200,
  PATH_LENGTH_BONUS_BASE: 100,
} as const;
