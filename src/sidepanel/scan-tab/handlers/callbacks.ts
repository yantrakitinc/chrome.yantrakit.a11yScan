/**
 * Cross-module callbacks bound once at startup so handler modules can call
 * back into scan-tab.ts (renderScanTab, manual-review storage helpers)
 * without creating an import cycle. scan-tab.ts calls
 * `bindScanTabCallbacks` once at module load.
 */

let _rerender: () => void = () => {};
let _loadManualReviewFor: (url: string) => void = () => {};
let _saveManualReviewFor: (url: string) => void = () => {};

export function bindScanTabCallbacks(opts: {
  rerender: () => void;
  loadManualReview: (url: string) => void;
  saveManualReview: (url: string) => void;
}): void {
  _rerender = opts.rerender;
  _loadManualReviewFor = opts.loadManualReview;
  _saveManualReviewFor = opts.saveManualReview;
}

/** Trigger a full re-render of the scan tab. */
export const rerender = (): void => _rerender();
/** Restore manual-review state for the given URL from chrome.storage.local. */
export const loadManualReviewFor = (url: string): void => _loadManualReviewFor(url);
/** Persist current manual-review state for the given URL. */
export const saveManualReviewFor = (url: string): void => _saveManualReviewFor(url);
