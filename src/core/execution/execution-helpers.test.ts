import { describe, expect, test } from "vitest";
import {
  getFileExecutionHint,
  isDevCommand,
  isScaffoldCommand,
  isValidationCommand,
} from "./execution-helpers.ts";

describe("execution-helpers", () => {
  test("识别常见包管理器的开发和验证命令", () => {
    expect(isDevCommand("npm run dev")).toBe(true);
    expect(isDevCommand("pnpm dev")).toBe(true);
    expect(isDevCommand("yarn dev")).toBe(true);
    expect(isDevCommand("bun run dev")).toBe(true);
    expect(isValidationCommand("npm run build")).toBe(true);
    expect(isValidationCommand("pnpm typecheck")).toBe(true);
    expect(isValidationCommand("yarn test")).toBe(true);
  });

  test("识别安装命令和常见锁文件", () => {
    expect(isScaffoldCommand("npm install")).toBe(true);
    expect(isScaffoldCommand("pnpm install")).toBe(true);
    expect(isScaffoldCommand("yarn install")).toBe(true);
    expect(getFileExecutionHint("/tmp/package-lock.json").phase).toBe("scaffold");
    expect(getFileExecutionHint("/tmp/pnpm-lock.yaml").phase).toBe("scaffold");
  });
});
