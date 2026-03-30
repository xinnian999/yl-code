import type { StructuredToolInterface } from "@langchain/core/tools";
import type { AgentModeValue } from "../types.ts";

/** 带模式标签的工具定义 */
export interface ModeTool {
  /** LangChain 工具实例 */
  tool: StructuredToolInterface;
  /** 允许使用该工具的模式列表 */
  modes: AgentModeValue[];
}

/** 按模式筛选当前可用工具 */
export function getToolsForMode(
  tools: ModeTool[],
  mode: AgentModeValue
): StructuredToolInterface[] {
  return tools
    .filter((item) => item.modes.includes(mode))
    .map((item) => item.tool);
}
