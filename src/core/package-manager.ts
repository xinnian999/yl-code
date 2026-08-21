import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** 支持识别的包管理器 */
export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

/** 包管理器对应的常用命令 */
export interface PackageManagerCommands {
  /** 安装依赖命令 */
  install: string;
  /** 启动开发服务命令 */
  dev: string;
  /** 构建命令 */
  build: string;
  /** 测试命令 */
  test: string;
  /** 类型检查命令 */
  typecheck: string;
}

/** 从 package.json 读取显式声明的包管理器 */
function readDeclaredPackageManager(workingDirectory: string): PackageManager | null {
  const packagePath = join(workingDirectory, "package.json");
  if (!existsSync(packagePath)) return null;

  try {
    const packageJson = JSON.parse(readFileSync(packagePath, "utf-8"));
    const declared = typeof packageJson.packageManager === "string"
      ? packageJson.packageManager.split("@")[0]
      : "";
    if (["npm", "pnpm", "yarn", "bun"].includes(declared)) {
      return declared as PackageManager;
    }
  } catch {
    return null;
  }
  return null;
}

/** 根据声明或锁文件识别目标项目的包管理器 */
export function detectPackageManager(workingDirectory: string): PackageManager {
  const declared = readDeclaredPackageManager(workingDirectory);
  if (declared) return declared;

  const lockFiles: Array<[PackageManager, string[]]> = [
    ["pnpm", ["pnpm-lock.yaml"]],
    ["yarn", ["yarn.lock"]],
    ["bun", ["bun.lock", "bun.lockb"]],
    ["npm", ["package-lock.json", "npm-shrinkwrap.json"]],
  ];
  const detected = lockFiles.find(([, files]) => {
    return files.some((file) => existsSync(join(workingDirectory, file)));
  });
  return detected?.[0] ?? "npm";
}

/** 生成目标项目包管理器对应的常用命令 */
export function getPackageManagerCommands(manager: PackageManager): PackageManagerCommands {
  const runPrefix = manager === "yarn" ? "yarn" : `${manager} run`;
  const install = manager === "yarn" ? "yarn install" : `${manager} install`;
  return {
    install,
    dev: `${runPrefix} dev`,
    build: `${runPrefix} build`,
    test: `${runPrefix} test`,
    typecheck: `${runPrefix} typecheck`,
  };
}
