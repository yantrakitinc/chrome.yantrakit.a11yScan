/**
 * Export action bar: JSON / HTML / PDF / Copy buttons. Closure-bound report
 * builders that gather live state into the pure builder shapes.
 */

import { state } from "../../sidepanel";
import { getTabOrder, getFocusGaps } from "../../kb-tab";
import type { iJsonReport } from "@shared/types";
import { buildJsonReportFrom, buildHtmlReportFrom } from "../reports";
import { downloadBlob, getDomain, getDateStamp } from "./dom-utils";

function buildJsonReport(): iJsonReport {
  return buildJsonReportFrom({
    lastScanResult: state.lastScanResult,
    crawlResults: state.crawlResults,
    crawlFailed: state.crawlFailed,
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    manualReview: state.manualReview,
    ariaWidgets: state.ariaWidgets,
    lastMvResult: state.lastMvResult,
    tabOrder: getTabOrder(),
    focusGaps: getFocusGaps(),
    documentTitle: document.title,
    nowIso: new Date().toISOString(),
  });
}

function buildHtmlReport(): string {
  if (!state.lastScanResult) throw new Error("buildHtmlReport called without a single-page scan result");
  return buildHtmlReportFrom({
    scan: state.lastScanResult,
    wcagVersion: state.wcagVersion,
    wcagLevel: state.wcagLevel,
    manualReview: state.manualReview,
    ariaWidgets: state.ariaWidgets,
  });
}

/** True if there's anything we can export — single-page scan OR crawl results. */
const hasExportableData = (): boolean =>
  !!state.lastScanResult || !!(state.crawlResults && Object.keys(state.crawlResults).length > 0);

/** Wire the Export action bar buttons — JSON / HTML / PDF / Copy. Each gates on hasExportableData() and pulls live state into the pure builders. */
export function attachExportListeners(): void {
  document.getElementById("export-json")?.addEventListener("click", () => {
    if (!hasExportableData()) return;
    const report = buildJsonReport();
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    downloadBlob(blob, `A11y-Scan-Report-${getDomain()}-${getDateStamp()}.json`);
  });

  // HTML/PDF require a single-page scan — crawl-only data has no page-level layout.
  document.getElementById("export-html")?.addEventListener("click", () => {
    if (!state.lastScanResult) return;
    const html = buildHtmlReport();
    const blob = new Blob([html], { type: "text/html" });
    downloadBlob(blob, `A11y-Scan-Report-${getDomain()}-${getDateStamp()}.html`);
  });
  document.getElementById("export-pdf")?.addEventListener("click", () => {
    if (!state.lastScanResult) return;
    const html = buildHtmlReport();
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    } else {
      // Popup blocked — surface a transient error in the button text per R-EXPORT.
      const btn = document.getElementById("export-pdf");
      if (btn) {
        const original = btn.textContent;
        btn.textContent = "Popup blocked";
        setTimeout(() => { btn.textContent = original; }, 3000);
      }
    }
  });

  document.getElementById("export-copy")?.addEventListener("click", async () => {
    if (!hasExportableData()) return;
    const report = buildJsonReport();
    const btn = document.getElementById("export-copy");
    try {
      await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
      if (btn) {
        btn.textContent = "Copied!";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      }
    } catch {
      // Clipboard can fail on insecure contexts or permission-denied. Per
      // R-EXPORT: 'If clipboard write fails: button text changes to Copy
      // failed for 2s'.
      if (btn) {
        btn.textContent = "Copy failed";
        setTimeout(() => { btn.textContent = "Copy"; }, 2000);
      }
    }
  });
}
