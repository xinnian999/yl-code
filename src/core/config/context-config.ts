/** 默认最大上下文 token 数 */
export const DEFAULT_MAX_TOKENS = 128000;

/** 触发摘要的上下文占比 */
export const SUMMARIZE_THRESHOLD_RATIO = 0.25;

/** 触发摘要的 token 阈值 */
export const SUMMARIZE_THRESHOLD = Math.round(
  DEFAULT_MAX_TOKENS * SUMMARIZE_THRESHOLD_RATIO
);

/** 摘要时保留的最近消息窗口数 */
export const CONTEXT_SUMMARY_KEEP_RECENT_MESSAGES = 12;

/** 历史压缩时保护的最近消息窗口数 */
export const CONTEXT_COMPACT_PROTECT_RECENT_MESSAGES = 10;

/** 触发有效摘要所需的最小源消息 token 数 */
export const MIN_SUMMARIZE_SOURCE_TOKENS = 1000;

/** 大文本进入历史压缩的字符阈值 */
export const CONTEXT_COMPACT_THRESHOLD = 1200;

/** 压缩后保留的预览字符数 */
export const CONTEXT_COMPACT_PREVIEW_CHARS = 240;

/** 对话摘要提示词 */
export const SUMMARIZE_PROMPT = `请将以下对话历史压缩为简洁的摘要，保留关键信息：
1. 用户的主要需求和意图
2. 已完成的操作和修改的文件
3. 重要的技术决策和上下文
4. 未完成的任务或待处理事项

请用中文输出摘要，尽量简洁但不遗漏关键信息。`;
