/**
 * Cross-module callback for re-render. Bound at startup so handlers /
 * movie / escape can call back into the orchestrator without a cycle.
 */

let _rerender: () => void = () => {};

/** Late-binding for kb-tab cross-module callbacks (rerender) so handlers don't import kb-tab.ts and create a cycle. */
export function bindKbTabCallbacks(opts: { rerender: () => void }): void {
  _rerender = opts.rerender;
}

export const rerender = (): void => _rerender();
