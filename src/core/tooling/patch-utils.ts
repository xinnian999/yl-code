import { applyPatch, type StructuredPatch } from "diff";

/** 构建 diff 库可消费的结构化补丁对象 */
function buildStructuredPatch(patchText: string): StructuredPatch | null {
  const normalized = patchText.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const hunks: Array<
    StructuredPatch["hunks"][number] & { linedelimiters: string[] }
  > = [];

  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.startsWith("@@")) {
      index += 1;
      continue;
    }

    const match = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
    const oldStart = match ? Number.parseInt(match[1], 10) : 1;
    const newStart = match ? Number.parseInt(match[3], 10) : 1;
    const hunkLines: string[] = [];
    const delimiters: string[] = [];

    index += 1;
    while (index < lines.length && !lines[index].startsWith("@@")) {
      const currentLine = lines[index];
      if (currentLine === "" && index === lines.length - 1) {
        index += 1;
        break;
      }

      if (/^[ +\-\\]/.test(currentLine)) {
        hunkLines.push(currentLine);
        delimiters.push("\n");
      }
      index += 1;
    }

    const oldLines = hunkLines.filter((item) => {
      return item[0] === " " || item[0] === "-";
    }).length;
    const newLines = hunkLines.filter((item) => {
      return item[0] === " " || item[0] === "+";
    }).length;

    hunks.push({
      oldStart,
      oldLines,
      newStart,
      newLines,
      lines: hunkLines,
      linedelimiters: delimiters,
    });
  }

  if (hunks.length === 0) {
    return null;
  }

  return {
    oldFileName: "",
    newFileName: "",
    oldHeader: "",
    newHeader: "",
    hunks,
  } as unknown as StructuredPatch;
}

/** 使用“原生 apply + 结构化补丁回退”应用 diff */
export function applyPatchWithFallback(
  originalContent: string,
  patchText: string
): string | false {
  try {
    const directResult = applyPatch(originalContent, patchText);
    if (directResult !== false) {
      return directResult;
    }
  } catch {
    // 原生字符串补丁失败时，继续尝试结构化补丁。
  }

  const structuredPatch = buildStructuredPatch(patchText);
  if (!structuredPatch) {
    return false;
  }

  try {
    return applyPatch(originalContent, structuredPatch);
  } catch {
    return false;
  }
}
