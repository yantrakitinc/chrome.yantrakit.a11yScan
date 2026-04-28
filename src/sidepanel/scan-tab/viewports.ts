/**
 * Multi-Viewport list manipulation. Pure — no DOM, no state.
 */

/**
 * Add a new viewport to the list. Returns a sorted, deduplicated copy.
 * Caps at 6 entries (returns the input unchanged when already at cap).
 * Picks a value 200px wider than the current widest.
 */
export function addViewport(viewports: number[], maxCount = 6): number[] {
  if (viewports.length >= maxCount) return viewports;
  const newVal = (viewports.length === 0 ? 320 : Math.max(...viewports) + 200);
  if (viewports.includes(newVal)) return viewports;
  return [...viewports, newVal].sort((a, b) => a - b);
}

/**
 * Remove the viewport at index `idx`. Refuses to remove the last entry
 * (can't have a 0-viewport MV scan). Returns the input unchanged when
 * idx is out of bounds.
 */
export function removeViewport(viewports: number[], idx: number, minCount = 1): number[] {
  if (viewports.length <= minCount) return viewports;
  if (idx < 0 || idx >= viewports.length) return viewports;
  return viewports.filter((_, i) => i !== idx);
}
