/** 顶层覆盖面板类型 */
export type OverlayView = "none" | "model" | "history" | "mcp" | "skills";

/** 判断当前是否有覆盖面板处于打开状态 */
export function hasOverlayView(view: OverlayView): boolean {
  return view !== "none";
}
