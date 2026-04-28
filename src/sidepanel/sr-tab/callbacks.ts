/**
 * Cross-module callbacks bound at startup. Lets playback.ts and handlers.ts
 * call back into the sr-tab orchestrator (renderScreenReaderTab) without an
 * import cycle. sr-tab.ts calls `bindSrTabCallbacks` once at module load.
 */

let _rerender: () => void = () => {};

export function bindSrTabCallbacks(opts: { rerender: () => void }): void {
  _rerender = opts.rerender;
}

export const rerender = (): void => _rerender();
