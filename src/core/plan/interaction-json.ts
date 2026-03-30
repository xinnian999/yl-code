/** 从文本中提取指定标签包裹的内容 */
export function extractTagContent(content: string, tag: string): string | null {
  const matcher = new RegExp(`<${tag}>\\s*([\\s\\S]*?)\\s*</${tag}>`, "i");
  const matched = content.match(matcher);
  if (!matched?.[1]) {
    return null;
  }
  return matched[1].trim();
}

/** 去掉可能包裹在外层的 Markdown 代码块 */
export function stripCodeFence(content: string): string {
  const matched = content.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (!matched?.[1]) {
    return content.trim();
  }
  return matched[1].trim();
}

/** 解析 JSON 文本为普通对象 */
export function parseJsonRecord(
  content: string
): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(stripCodeFence(content)) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}
