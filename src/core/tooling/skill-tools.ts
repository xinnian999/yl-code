import { tool } from "@langchain/core/tools";
import { z } from "zod";
import type { SkillManager } from "../skills/index.ts";
import type { SkillToolPayload } from "../skills/index.ts";

/** 创建 get_skills 工具 */
export function createGetSkillsTool(skillManager: SkillManager) {
  return tool(
    async ({ skillNames }: SkillToolPayload): Promise<string> => {
      return skillManager.getSkillsToolResult(skillNames);
    },
    {
      name: "get_skills",
      description: "按技能名称读取一个或多个 skill 的正文内容。适合在看到技能索引后按需加载技能说明。",
      schema: z.object({
        skillNames: z.array(z.string().min(1)).min(1).describe("要读取的技能名称列表"),
      }),
    },
  );
}
