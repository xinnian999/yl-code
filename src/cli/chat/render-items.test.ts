import { describe, expect, test } from "vitest";
import type { PendingChange } from "@/core/confirm-bus.ts";
import type { AIMessage, Message } from "@/core/message-bus.ts";
import { ThinkingStatus, type TodoItem } from "@/core/types.ts";
import { buildRenderItems, getDynamicTailCount } from "./render-items.ts";

/** 创建测试用任务列表 */
function createTodos(): TodoItem[] {
  return [
    { content: "准备环境", status: "completed" },
    { content: "运行测试", status: "in_progress" },
  ];
}

/** 创建测试用 AI 消息 */
function createAIMessage(blocks: AIMessage["blocks"]): AIMessage {
  return {
    id: "ai-1",
    type: "ai",
    blocks,
    timestamp: new Date("2026-03-30T12:00:00.000Z"),
  };
}

describe("buildRenderItems", () => {
  test("会把任务更新工具块和 todo 块合并为 ai_task_update", () => {
    const messages: Message[] = [
      {
        id: "user-1",
        type: "user",
        content: "请执行",
        timestamp: new Date("2026-03-30T11:59:00.000Z"),
      },
      createAIMessage([
        { type: "tool", content: "更新任务列表" },
        { type: "todo", todos: createTodos() },
        { type: "text", content: "任务已更新" },
      ]),
    ];

    const items = buildRenderItems({
      messages,
      thinkingStatus: {
        status: ThinkingStatus.IDLE,
        detail: "",
      },
      streamingBlockIndex: -1,
      isProcessing: false,
      pendingChange: null,
      diffEditorOpened: null,
      pendingPlanInteraction: null,
      modelId: "test-model",
      version: "1.0.11",
      hasProjectRules: true,
    });

    expect(items.map((item) => item.kind)).toEqual([
      "welcome",
      "user",
      "ai_task_update",
      "ai_block",
    ]);
    expect(items[0].kind === "welcome" ? items[0].hasProjectRules : false).toBe(
      true,
    );
  });

  test("存在待确认 diff 时会补出 diff 行和动态状态行", () => {
    const pendingChange: PendingChange = {
      id: "change-1",
      type: "file",
      filePath: "/tmp/demo.ts",
      originalContent: "old",
      newContent: "new",
    };
    const items = buildRenderItems({
      messages: [createAIMessage([{ type: "text", content: "准备写文件" }])],
      thinkingStatus: {
        status: ThinkingStatus.THINKING,
        detail: "",
      },
      streamingBlockIndex: -1,
      isProcessing: true,
      pendingChange,
      diffEditorOpened: null,
      pendingPlanInteraction: null,
      modelId: "test-model",
      version: "1.0.11",
      hasProjectRules: false,
    });

    expect(items.map((item) => item.kind)).toEqual([
      "welcome",
      "ai_block",
      "ai_diff",
      "ai_stats",
    ]);
    expect(getDynamicTailCount(items)).toBe(1);
  });
});
