/** 列表导航方向 */
export type ListDirection = "up" | "down";

/** 计算列表选中项变更后的索引 */
export function getNextSelectedIndex(
  currentIndex: number,
  itemCount: number,
  direction: ListDirection,
): number {
  if (itemCount <= 0) {
    return 0;
  }

  if (direction === "up") {
    return Math.max(currentIndex - 1, 0);
  }

  return Math.min(currentIndex + 1, itemCount - 1);
}

/** 根据当前列表长度裁剪选中索引 */
export function clampSelectedIndex(
  currentIndex: number,
  itemCount: number,
): number {
  if (itemCount <= 0) {
    return 0;
  }

  return Math.min(currentIndex, itemCount - 1);
}
