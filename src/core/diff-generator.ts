import { diffLines, Change } from "diff";

/**
 * Diff 行类型
 */
export type DiffLineType = "add" | "remove" | "unchanged";

/**
 * Diff 行
 */
export interface DiffLine {
  type: DiffLineType;
  content: string;
  lineNumber?: number;
}

/**
 * Diff 结果
 */
export interface DiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
}

/**
 * 生成两个文本之间的 diff
 */
export function generateDiff(
  originalContent: string,
  newContent: string
): DiffResult {
  const changes: Change[] = diffLines(originalContent, newContent);
  
  const lines: DiffLine[] = [];
  let addedCount = 0;
  let removedCount = 0;
  let unchangedCount = 0;
  
  for (const change of changes) {
    // 按行分割内容
    const contentLines = change.value.split("\n");
    // 移除最后一个空行（如果是换行符导致的）
    if (contentLines[contentLines.length - 1] === "") {
      contentLines.pop();
    }
    
    for (const line of contentLines) {
      if (change.added) {
        lines.push({ type: "add", content: line });
        addedCount++;
      } else if (change.removed) {
        lines.push({ type: "remove", content: line });
        removedCount++;
      } else {
        lines.push({ type: "unchanged", content: line });
        unchangedCount++;
      }
    }
  }
  
  return {
    lines,
    addedCount,
    removedCount,
    unchangedCount,
  };
}

/**
 * 生成紧凑的 diff（只显示变更部分和上下文）
 * @param contextLines 上下文行数
 */
export function generateCompactDiff(
  originalContent: string,
  newContent: string,
  contextLines: number = 3
): DiffResult {
  const fullDiff = generateDiff(originalContent, newContent);
  const { lines } = fullDiff;
  
  if (lines.length === 0) {
    return fullDiff;
  }
  
  // 标记需要显示的行
  const showLine: boolean[] = new Array(lines.length).fill(false);
  
  // 找出所有变更行，并标记其上下文
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].type !== "unchanged") {
      // 标记变更行及其上下文
      const start = Math.max(0, i - contextLines);
      const end = Math.min(lines.length - 1, i + contextLines);
      for (let j = start; j <= end; j++) {
        showLine[j] = true;
      }
    }
  }
  
  // 过滤出需要显示的行
  const compactLines: DiffLine[] = [];
  let lastShownIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (showLine[i]) {
      // 如果有跳过的行，添加省略标记
      if (lastShownIndex !== -1 && i - lastShownIndex > 1) {
        compactLines.push({
          type: "unchanged",
          content: `... (省略 ${i - lastShownIndex - 1} 行) ...`,
        });
      }
      compactLines.push(lines[i]);
      lastShownIndex = i;
    }
  }
  
  return {
    lines: compactLines,
    addedCount: fullDiff.addedCount,
    removedCount: fullDiff.removedCount,
    unchangedCount: fullDiff.unchangedCount,
  };
}

/**
 * 检查是否有实际变更
 */
export function hasChanges(originalContent: string, newContent: string): boolean {
  return originalContent !== newContent;
}
