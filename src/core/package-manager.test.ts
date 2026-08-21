import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { detectPackageManager, getPackageManagerCommands } from "./package-manager.ts";

/** 创建临时项目并写入指定文件 */
function createProject(files: Record<string, string>): string {
  const directory = mkdtempSync(join(tmpdir(), "yl-package-manager-"));
  Object.entries(files).forEach(([file, content]) => {
    const filePath = join(directory, file);
    mkdirSync(join(filePath, ".."), { recursive: true });
    writeFileSync(filePath, content);
  });
  return directory;
}

describe("package-manager", () => {
  test("优先使用 package.json 的显式声明", () => {
    const directory = createProject({
      "package.json": JSON.stringify({ packageManager: "pnpm@10.0.0" }),
      "package-lock.json": "{}",
    });
    try {
      expect(detectPackageManager(directory)).toBe("pnpm");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  test("根据锁文件识别包管理器，并在未知时回退 npm", () => {
    const bunProject = createProject({ "bun.lock": "{}" });
    const emptyProject = createProject({});
    try {
      expect(detectPackageManager(bunProject)).toBe("bun");
      expect(detectPackageManager(emptyProject)).toBe("npm");
      expect(getPackageManagerCommands("npm").build).toBe("npm run build");
      expect(getPackageManagerCommands("yarn").build).toBe("yarn build");
    } finally {
      rmSync(bunProject, { recursive: true, force: true });
      rmSync(emptyProject, { recursive: true, force: true });
    }
  });
});
