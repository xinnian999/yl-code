import { tool } from "@langchain/core/tools";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ConfirmPort } from "../types.ts";
import {
  sanitizeDisplayText,
  toDisplayPath,
} from "../path-display.ts";
import { applyPatchWithFallback } from "./patch-utils.ts";

/** 文件写入载荷 */
interface WriteFilePayload {
  /** 文件路径 */
  filePath: string;
  /** 文件内容 */
  content: string;
}

/** 文件补丁写入载荷 */
interface WriteFilePatchPayload {
  /** 文件路径 */
  filePath: string;
  /** 统一 diff 补丁 */
  patch: string;
}

/** 读取文件载荷 */
interface ReadFilePayload {
  /** 文件路径 */
  filePath: string;
}

/** 读取目录载荷 */
interface ListDirectoryPayload {
  /** 目录路径 */
  directoryPath: string;
}

/** 读取原始文件内容，不存在时按新文件处理 */
async function readOriginalFileContent(resolvedPath: string): Promise<string> {
  try {
    return await fs.readFile(resolvedPath, "utf-8");
  } catch {
    return "";
  }
}

/** 将确认通过后的文件内容落盘 */
async function persistFileContent(
  resolvedPath: string,
  content: string
): Promise<void> {
  await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
  await fs.writeFile(resolvedPath, content, "utf-8");
}

/** 生成文件写入结果文案 */
function buildWriteFileResult(
  originalContent: string,
  displayPath: string
): string {
  return originalContent === ""
    ? `文件创建成功: ${displayPath}`
    : `文件写入成功: ${displayPath}`;
}

/** 创建 read_file 工具 */
export function createReadFileTool() {
  return tool(
    async ({ filePath }: ReadFilePayload): Promise<string> => {
      const resolvedPath = path.resolve(filePath);
      const displayPath = toDisplayPath(resolvedPath);

      try {
        const content = await fs.readFile(resolvedPath, "utf-8");
        return `文件内容:\n${content}`;
      } catch (error) {
        const err = error as Error;
        return `读取文件失败: ${sanitizeDisplayText(err.message, resolvedPath) || displayPath}`;
      }
    },
    {
      name: "read_file",
      description: "读取指定路径的文件内容",
      schema: z.object({
        filePath: z.string().describe("文件路径"),
      }),
    }
  );
}

/** 创建 write_file 工具 */
export function createWriteFileTool(confirm: ConfirmPort) {
  return tool(
    async ({ filePath, content }: WriteFilePayload): Promise<string> => {
      const resolvedPath = path.resolve(filePath);
      const displayPath = toDisplayPath(resolvedPath);

      try {
        const originalContent = await readOriginalFileContent(resolvedPath);
        if (originalContent === content) {
          return `文件内容未变化，无需写入: ${displayPath}`;
        }

        const result = await confirm.requestConfirm(
          resolvedPath,
          originalContent,
          content
        );
        if (result === "reject") {
          return `用户拒绝了对 ${displayPath} 的修改，请根据情况调整方案或询问用户意见`;
        }

        await persistFileContent(resolvedPath, content);
        return buildWriteFileResult(originalContent, displayPath);
      } catch (error) {
        const err = error as Error;
        return `写入文件失败: ${sanitizeDisplayText(err.message, resolvedPath) || displayPath}`;
      }
    },
    {
      name: "write_file",
      description: "向指定路径写入文件内容，自动创建目录。写入前会请求用户确认。",
      schema: z.object({
        filePath: z.string().describe("文件路径"),
        content: z.string().describe("要写入的文件内容"),
      }),
    }
  );
}

/** 创建 write_file_patch 工具 */
export function createWriteFilePatchTool(confirm: ConfirmPort) {
  return tool(
    async ({ filePath, patch }: WriteFilePatchPayload): Promise<string> => {
      const resolvedPath = path.resolve(filePath);
      const displayPath = toDisplayPath(resolvedPath);

      try {
        const originalContent = await readOriginalFileContent(resolvedPath);
        const patchedContent = applyPatchWithFallback(originalContent, patch);
        if (patchedContent === false) {
          return `补丁应用失败: ${displayPath}`;
        }
        if (patchedContent === originalContent) {
          return `文件内容未变化，无需写入: ${displayPath}`;
        }

        const result = await confirm.requestConfirm(
          resolvedPath,
          originalContent,
          patchedContent
        );
        if (result === "reject") {
          return `用户拒绝了对 ${displayPath} 的修改，请根据情况调整方案或询问用户意见`;
        }

        await persistFileContent(resolvedPath, patchedContent);
        return buildWriteFileResult(originalContent, displayPath);
      } catch (error) {
        const err = error as Error;
        return `写入文件失败: ${sanitizeDisplayText(err.message, resolvedPath) || displayPath}`;
      }
    },
    {
      name: "write_file_patch",
      description: "使用统一 diff 补丁写入文件内容，避免传输完整文件。补丁需包含 @@ 片段和以空格/+/− 开头的行，无需精确计算统计数字。写入前会请求用户确认。",
      schema: z.object({
        filePath: z.string().describe("文件路径"),
        patch: z.string().describe("统一 diff 格式的补丁内容"),
      }),
    }
  );
}

/** 创建 list_directory 工具 */
export function createListDirectoryTool() {
  return tool(
    async ({ directoryPath }: ListDirectoryPayload): Promise<string> => {
      const resolvedPath = path.resolve(directoryPath);
      try {
        const files = await fs.readdir(resolvedPath);
        return `目录内容:\n${files.map((fileName) => `- ${fileName}`).join("\n")}`;
      } catch (error) {
        const err = error as Error;
        return `列出目录失败: ${sanitizeDisplayText(err.message, resolvedPath)}`;
      }
    },
    {
      name: "list_directory",
      description: "列出指定目录下的所有文件和文件夹",
      schema: z.object({
        directoryPath: z.string().describe("目录路径"),
      }),
    }
  );
}
