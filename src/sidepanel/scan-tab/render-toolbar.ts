/**
 * Export/overlay toolbar inside the scan tab. Pure.
 */

/**
 * Render the export/overlay toolbar inside the scan tab. HTML/PDF exports
 * are disabled when there's no single-page scan because those formats
 * don't have a crawl-only layout.
 */
export function renderToolbarContentHtml(s: {
  hasSinglePageScan: boolean;
  violationsOverlayOn: boolean;
}): string {
  const disabledAttr = s.hasSinglePageScan ? "" : 'disabled aria-disabled="true" title="Run a single-page scan to enable this export"';
  return `
      <div class="toolbar-row">
        <span class="toolbar-label" id="export-label">Export</span>
        <button class="toolbar-btn" id="export-json" aria-labelledby="export-label export-json">JSON</button>
        <button class="toolbar-btn" id="export-html" aria-labelledby="export-label export-html" ${disabledAttr}>HTML</button>
        <button class="toolbar-btn" id="export-pdf" aria-labelledby="export-label export-pdf" ${disabledAttr}>PDF</button>
        <button class="toolbar-btn accent" id="export-copy" aria-label="Copy report JSON to clipboard">Copy</button>
      </div>
      <div class="toolbar-row">
        <span class="toolbar-label">Highlight</span>
        <button class="toolbar-btn${s.violationsOverlayOn ? " active" : ""}" id="toggle-violations" aria-pressed="${s.violationsOverlayOn}" ${s.hasSinglePageScan ? "" : 'disabled aria-disabled="true"'}>Violations</button>
      </div>
  `;
}
