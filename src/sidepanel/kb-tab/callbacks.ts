/**
 * Cross-module callback for re-render. Bound at startup so handlers /
 * movie / escape can call back into the orchestrator without a cycle.
 */

let _rerender: () => void = () => {};

export function bindKbTabCallbacks(opts: { rerender: () => void }): void {
  _rerender = opts.rerender;
}

export const rerender = (): void => _rerender();
