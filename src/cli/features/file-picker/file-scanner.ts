import { readdirSync, statSync, readFileSync, existsSync } from "fs";
import { join, dirname, basename, relative } from "path";

export interface FileItem {
  name: string;
  path: string;
  relativePath: string;
  isDirectory: boolean;
}

// 忽略的目录和文件
const IGNORED_PATTERNS = [
  "node_modules",
  ".git",
  ".DS_Store",
  "dist",
  "build",
  ".next",
  ".cache",
  "coverage",
];

// 缓存扫描结果
let cachedFiles: FileItem[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5000; // 5秒缓存

/**
 * 判断是否应该忽略该文件/目录
 */
function shouldIgnore(name: string): boolean {
  if (name.startsWith(".")) return true;
  return IGNORED_PATTERNS.includes(name);
}

/**
 * 递归扫描目录，返回所有文件和目录
 */
function scanAllFiles(basePath: string, currentPath: string = ""): FileItem[] {
  const results: FileItem[] = [];
  const fullPath = currentPath ? join(basePath, currentPath) : basePath;

  try {
    const entries = readdirSync(fullPath);

    for (const entry of entries) {
      if (shouldIgnore(entry)) continue;

      const entryFullPath = join(fullPath, entry);
      const entryRelativePath = currentPath ? join(currentPath, entry) : entry;

      try {
        const stat = statSync(entryFullPath);
        const isDir = stat.isDirectory();

        results.push({
          name: entry,
          path: entryFullPath,
          relativePath: entryRelativePath,
          isDirectory: isDir,
        });

        // 递归扫描子目录
        if (isDir) {
          results.push(...scanAllFiles(basePath, entryRelativePath));
        }
      } catch {
        // 忽略无法访问的文件
      }
    }
  } catch {
    // 目录不存在或无法访问
  }

  return results;
}

/**
 * 获取所有文件（带缓存）
 */
function getAllFiles(basePath: string): FileItem[] {
  const now = Date.now();
  if (cachedFiles && now - cacheTime < CACHE_TTL) {
    return cachedFiles;
  }

  cachedFiles = scanAllFiles(basePath);
  cacheTime = now;
  return cachedFiles;
}

/**
 * 清除文件缓存
 */
export function clearFileCache(): void {
  cachedFiles = null;
  cacheTime = 0;
}

/**
 * 扫描目录，根据 filter 模糊匹配文件和目录
 * @param basePath 基础路径（通常是 process.cwd()）
 * @param filter @ 后面的过滤字符串
 */
export function scanDirectory(basePath: string, filter: string): FileItem[] {
  const allFiles = getAllFiles(basePath);

  if (!filter) {
    // 没有过滤条件，只返回根目录下的文件和目录
    return allFiles
      .filter((f) => !f.relativePath.includes("/"))
      .sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) {
          return a.isDirectory ? -1 : 1;
        }
        return a.name.localeCompare(b.name);
      });
  }

  const filterLower = filter.toLowerCase();

  // 计算匹配分数
  const scored = allFiles.map((file) => {
    const nameLower = file.name.toLowerCase();
    const pathLower = file.relativePath.toLowerCase();
    let score = 0;

    // 文件名完全匹配（最高优先级）
    if (nameLower === filterLower) {
      score = 1000;
    }
    // 文件名前缀匹配
    else if (nameLower.startsWith(filterLower)) {
      score = 800 + (100 - file.relativePath.length); // 路径短的优先
    }
    // 文件名包含匹配
    else if (nameLower.includes(filterLower)) {
      score = 600 + (100 - file.relativePath.length);
    }
    // 完整路径前缀匹配
    else if (pathLower.startsWith(filterLower)) {
      score = 400 + (100 - file.relativePath.length);
    }
    // 完整路径包含匹配
    else if (pathLower.includes(filterLower)) {
      score = 200 + (100 - file.relativePath.length);
    }

    return { file, score };
  });

  // 过滤并排序
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      // 分数高的优先
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      // 分数相同时，目录优先
      if (a.file.isDirectory !== b.file.isDirectory) {
        return a.file.isDirectory ? -1 : 1;
      }
      // 最后按名称排序
      return a.file.name.localeCompare(b.file.name);
    })
    .map((item) => item.file)
    .slice(0, 50); // 限制返回数量
}

/**
 * 读取文件或目录内容
 * @param filePath 文件或目录路径
 * @param maxSize 最大读取大小（字节），默认 100KB
 */
export function getFileContent(
  filePath: string,
  maxSize: number = 100 * 1024
): string {
  try {
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // 列出目录内容
      return getDirectoryTree(filePath, "", 2);
    }

    if (stat.size > maxSize) {
      const content = readFileSync(filePath, "utf-8").slice(0, maxSize);
      return `${content}\n\n... [文件过大，已截断，共 ${stat.size} 字节]`;
    }

    return readFileSync(filePath, "utf-8");
  } catch (error) {
    const err = error as Error;
    return `[无法读取: ${err.message}]`;
  }
}

/**
 * 获取目录树结构
 * @param dirPath 目录路径
 * @param prefix 前缀（用于缩进）
 * @param maxDepth 最大深度
 */
function getDirectoryTree(dirPath: string, prefix: string = "", maxDepth: number = 2): string {
  if (maxDepth <= 0) return prefix + "...\n";

  const lines: string[] = [];
  
  try {
    const entries = readdirSync(dirPath);
    const filtered = entries.filter((e) => !shouldIgnore(e));
    
    filtered.forEach((entry, index) => {
      const isLast = index === filtered.length - 1;
      const connector = isLast ? "└── " : "├── ";
      const fullPath = join(dirPath, entry);
      
      try {
        const stat = statSync(fullPath);
        const isDir = stat.isDirectory();
        
        lines.push(`${prefix}${connector}${entry}${isDir ? "/" : ""}`);
        
        if (isDir && maxDepth > 1) {
          const newPrefix = prefix + (isLast ? "    " : "│   ");
          lines.push(getDirectoryTree(fullPath, newPrefix, maxDepth - 1));
        }
      } catch {
        lines.push(`${prefix}${connector}${entry} [无法访问]`);
      }
    });
  } catch {
    return prefix + "[无法读取目录]\n";
  }

  return lines.join("\n");
}

/**
 * 解析输入中的 @ 引用
 * @param input 用户输入
 * @returns 引用的文件路径数组
 */
export function parseAtReferences(input: string): string[] {
  const references: string[] = [];
  // 匹配 @path/to/file 格式，路径可以包含字母、数字、下划线、连字符、点和斜杠
  const regex = /@([\w\-./]+)/g;
  let match;

  while ((match = regex.exec(input)) !== null) {
    references.push(match[1]);
  }

  return references;
}

/**
 * 从输入中提取最后一个 @ 引用的过滤字符串
 * @param input 用户输入
 * @returns { atIndex: number, filter: string } | null
 */
export function extractAtFilter(
  input: string
): { atIndex: number; filter: string } | null {
  // 从后往前找最后一个 @
  const lastAtIndex = input.lastIndexOf("@");

  if (lastAtIndex === -1) {
    return null;
  }

  // 检查 @ 前面是否是空格或在开头（确保是独立的 @）
  if (lastAtIndex > 0 && input[lastAtIndex - 1] !== " ") {
    return null;
  }

  // 提取 @ 后面的内容（直到空格或结尾）
  const afterAt = input.slice(lastAtIndex + 1);
  const spaceIndex = afterAt.indexOf(" ");
  const filter = spaceIndex === -1 ? afterAt : afterAt.slice(0, spaceIndex);

  // 如果 @ 后面有空格，说明这个引用已经完成了
  if (spaceIndex !== -1) {
    return null;
  }

  return { atIndex: lastAtIndex, filter };
}
