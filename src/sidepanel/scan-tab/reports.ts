/**
 * JSON + HTML report builders. Pure — every input flows through the
 * function parameter. The closure-bound wrappers in scan-tab.ts collect
 * live state and call these.
 */

import type {
  iScanResult, iAriaWidget, iJsonReport, iMultiViewportResult,
  iTabOrderElement, iFocusGap,
} from "@shared/types";
import { getManualReviewCriteria } from "@shared/wcag-mapping";
import { escHtml } from "@shared/utils";
import { computeReportSummary, severityOrder } from "./formatting";

/**
 * Build the JSON export report from a snapshot of sidepanel state. Tests
 * can pass any shape they want to exercise the conditional sections
 * (manualReview, ariaWidgets, tabOrder, focusGaps, viewportAnalysis,
 * crawl).
 */
export function buildJsonReportFrom(s: {
  lastScanResult: iScanResult | null;
  crawlResults: Record<string, iScanResult> | null;
  crawlFailed: Record<string, string> | null;
  wcagVersion: string;
  wcagLevel: string;
  manualReview: Record<string, "pass" | "fail" | "na" | null>;
  ariaWidgets: iAriaWidget[];
  lastMvResult: iMultiViewportResult | null;
  tabOrder: iTabOrderElement[];
  focusGaps: iFocusGap[];
  documentTitle: string;
  nowIso: string;
}): iJsonReport {
  const r = s.lastScanResult;
  const firstCrawlPage = !r && s.crawlResults
    ? Object.values(s.crawlResults)[0] ?? null
    : null;
  const anchor = r ?? firstCrawlPage;
  const violations = r ? r.violations : [];
  const passes = r ? r.passes : [];
  const incomplete = r ? r.incomplete : [];

  const report: iJsonReport = {
    metadata: {
      url: anchor?.url ?? "",
      title: s.documentTitle || anchor?.url || "",
      timestamp: anchor?.timestamp ?? s.nowIso,
      wcagVersion: s.wcagVersion,
      wcagLevel: s.wcagLevel,
      toolVersion: "1.0.0",
      scanDurationMs: anchor?.scanDurationMs ?? 0,
    },
    summary: computeReportSummary(violations, passes, incomplete),
    violations,
    passes,
    incomplete,
  };

  // F12-AC8: manual review criteria with statuses
  const allCriteria = getManualReviewCriteria(s.wcagVersion, s.wcagLevel);
  const pageElements = s.lastScanResult?.pageElements;
  const filteredCriteria = pageElements
    ? allCriteria.filter((c) => !c.relevantWhen || pageElements[c.relevantWhen as keyof typeof pageElements])
    : allCriteria;
  const reviewedCount = Object.values(s.manualReview).filter((v) => v !== null).length;
  if (reviewedCount > 0) {
    report.manualReview = {
      reviewed: reviewedCount,
      total: filteredCriteria.length,
      criteria: filteredCriteria.map((c) => ({
        id: c.id,
        name: c.name,
        status: s.manualReview[c.id] ?? null,
      })),
    };
  }

  if (s.ariaWidgets.length > 0) report.ariaWidgets = s.ariaWidgets;
  if (s.tabOrder.length > 0) report.tabOrder = s.tabOrder;
  if (s.focusGaps.length > 0) report.focusGaps = s.focusGaps;
  if (s.lastMvResult) report.viewportAnalysis = s.lastMvResult;

  if (s.crawlResults && Object.keys(s.crawlResults).length > 0) {
    const failedEntries = s.crawlFailed ?? {};
    report.crawl = {
      pagesScanned: Object.keys(s.crawlResults).length,
      pagesFailed: Object.keys(failedEntries).length,
      results: s.crawlResults,
    };
  }

  return report;
}

/**
 * Build a self-contained HTML report. The output is downloaded by the user
 * and opened standalone, so all CSS is inlined and color literals are used
 * directly (the design tokens aren't available outside the side panel).
 *
 * Throws if `scan` is null since the caller gates on state.lastScanResult.
 */
export function buildHtmlReportFrom(s: {
  scan: iScanResult;
  wcagVersion: string;
  wcagLevel: string;
  manualReview: Record<string, "pass" | "fail" | "na" | null>;
  ariaWidgets: iAriaWidget[];
}): string {
  const r = s.scan;
  const totalViolationNodes = r.violations.reduce((sum, v) => sum + v.nodes.length, 0);
  const totalRules = r.violations.length + r.passes.length;
  const passRate = totalRules > 0 ? Math.round((r.passes.length / totalRules) * 100) : 100;
  const severityColor: Record<string, string> = { critical: "#991b1b", serious: "#c2410c", moderate: "#a16207", minor: "#4b5563" };

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width">
<title>A11y Scan Report — ${escHtml(r.url)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #18181b; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  .meta { font-size: 13px; color: #52525b; margin-bottom: 24px; }
  .summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
  .summary-card { text-align: center; padding: 16px; border: 1px solid #e4e4e7; border-radius: 8px; }
  .summary-card .num { font-size: 28px; font-weight: 800; }
  .summary-card .label { font-size: 12px; color: #52525b; }
  .violation { border-left: 4px solid; padding: 12px; margin-bottom: 8px; background: #fff; border-radius: 0 4px 4px 0; }
  .violation h3 { margin: 0 0 4px; font-size: 14px; }
  .violation .impact { font-size: 12px; font-weight: 700; text-transform: uppercase; }
  .node { font-size: 12px; font-family: monospace; background: #f4f4f5; padding: 6px 8px; border-radius: 4px; margin: 4px 0; }
  .pass { font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f4f4f5; color: #047857; }
  @media print { body { padding: 0; } .violation { break-inside: avoid; } }
</style>
</head>
<body>
<h1>Accessibility Scan Report</h1>
<div class="meta">
  <div><strong>URL:</strong> ${escHtml(r.url)}</div>
  <div><strong>Scanned:</strong> ${new Date(r.timestamp).toLocaleString()}</div>
  <div><strong>WCAG:</strong> ${s.wcagVersion} ${s.wcagLevel} &middot; <strong>Duration:</strong> ${r.scanDurationMs}ms</div>
</div>
<div class="summary">
  <div class="summary-card"><div class="num" style="color:var(--ds-red-700)">${totalViolationNodes}</div><div class="label">Violations</div></div>
  <div class="summary-card"><div class="num" style="color:var(--ds-green-700)">${r.passes.length}</div><div class="label">Passes</div></div>
  <div class="summary-card"><div class="num" style="color:var(--ds-amber-700)">${r.incomplete.length}</div><div class="label">Review</div></div>
  <div class="summary-card"><div class="num">${passRate}%</div><div class="label">Pass Rate</div></div>
</div>
<h2>Violations (${r.violations.length} rules)</h2>
${r.violations.sort((a, b) => severityOrder(a.impact) - severityOrder(b.impact)).map((v) => `
<div class="violation" style="border-color:${severityColor[v.impact] || "#4b5563"}">
  <h3>${escHtml(v.help || v.description)}</h3>
  <div class="impact" style="color:${severityColor[v.impact] || "#4b5563"}">${v.impact} &middot; ${v.wcagCriteria?.join(", ") || v.id}</div>
  ${v.nodes.map((n) => `<div class="node">${escHtml(n.selector)}<br>${escHtml(n.failureSummary)}</div>`).join("")}
</div>`).join("")}
<h2>Passed Rules (${r.passes.length})</h2>
${r.passes.map((p) => `<div class="pass">&check; ${escHtml(p.id)} — ${escHtml(p.description)} (${p.nodes.length} elements)</div>`).join("")}
${s.ariaWidgets.length > 0 ? `
<h2>ARIA Widgets (${s.ariaWidgets.length})</h2>
${s.ariaWidgets.map((w) => `<div class="pass">${w.failCount > 0 ? "&cross" : "&check"} ${escHtml(w.role)} — ${escHtml(w.label)} (${w.failCount} issues)</div>`).join("")}
` : ""}
${(() => {
  const allCriteria = getManualReviewCriteria(s.wcagVersion, s.wcagLevel);
  const pageElements = r.pageElements;
  const filteredCriteria = pageElements
    ? allCriteria.filter((c) => !c.relevantWhen || pageElements[c.relevantWhen as keyof typeof pageElements])
    : allCriteria;
  const reviewedCount = Object.values(s.manualReview).filter((v) => v !== null).length;
  if (reviewedCount === 0) return "";
  const rows = filteredCriteria.map((c) => {
    const status = s.manualReview[c.id] ?? null;
    const color = status === "pass" ? "#047857" : status === "fail" ? "#b91c1c" : status === "na" ? "#52525b" : "#a1a1aa";
    const label = status === "pass" ? "Pass" : status === "fail" ? "Fail" : status === "na" ? "N/A" : "Not reviewed";
    return `<tr><td style="padding:4px 8px;font-size:12px">${escHtml(c.id)}</td><td style="padding:4px 8px;font-size:12px">${escHtml(c.name)}</td><td style="padding:4px 8px;font-size:12px;font-weight:700;color:${color}">${label}</td></tr>`;
  }).join("");
  return `<h2>Manual Review (${reviewedCount}/${filteredCriteria.length} reviewed)</h2>
<table style="width:100%;border-collapse:collapse;margin-bottom:16px">
  <thead><tr style="background:var(--ds-zinc-100)"><th style="padding:6px 8px;text-align:left;font-size:12px">Criterion</th><th style="padding:6px 8px;text-align:left;font-size:12px">Name</th><th style="padding:6px 8px;text-align:left;font-size:12px">Status</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`;
})()}
<footer style="margin-top:32px;padding-top:16px;border-top:1px solid var(--ds-zinc-200);font-size:11px;color:var(--ds-zinc-500)">
  Generated by A11y Scan &middot; ${new Date().toISOString()}
</footer>
</body>
</html>`;
}
