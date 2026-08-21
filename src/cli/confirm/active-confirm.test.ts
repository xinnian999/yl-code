import { describe, expect, test } from "vitest";
import { deriveActiveConfirm, hasActiveConfirm } from "./active-confirm.ts";

describe("active-confirm", () => {
  test("diff 确认优先级高于计划交互", () => {
    const activeConfirm = deriveActiveConfirm({
      pendingChange: {
        id: "change-1",
        type: "command",
        command: "ls",
      },
      diffEditorOpened: null,
      pendingPlanInteraction: {
        id: "plan-1",
        type: "question",
        title: "确认范围",
        question: "是否继续？",
        options: [],
      },
    });

    expect(activeConfirm.kind).toBe("diff");
    expect(hasActiveConfirm(activeConfirm)).toBe(true);
  });

  test("能正确识别计划问题、计划预览和空确认态", () => {
    const questionConfirm = deriveActiveConfirm({
      pendingChange: null,
      diffEditorOpened: null,
      pendingPlanInteraction: {
        id: "plan-1",
        type: "question",
        title: "确认范围",
        question: "是否继续？",
        options: [],
      },
    });
    const previewConfirm = deriveActiveConfirm({
      pendingChange: null,
      diffEditorOpened: null,
      pendingPlanInteraction: {
        id: "plan-2",
        type: "preview",
        title: "最终计划",
        planMarkdown: "# demo",
      },
    });
    const emptyConfirm = deriveActiveConfirm({
      pendingChange: null,
      diffEditorOpened: null,
      pendingPlanInteraction: null,
    });

    expect(questionConfirm.kind).toBe("plan_question");
    expect(previewConfirm.kind).toBe("plan_preview");
    expect(emptyConfirm.kind).toBe("none");
    expect(hasActiveConfirm(emptyConfirm)).toBe(false);
  });
});
