/**
 * Pure renderers for scan results: single-page renderResults, single
 * renderViolation row, and the crawl-results table (by-page + by-WCAG views).
 */

import type { iScanResult, iMultiViewportResult } from "@shared/types";
import { escHtml } from "@shared/utils";
import { getWcagUrl } from "@shared/wcag-mapping";
import { severityOrder } from "./formatting";

/**
 * Render the Results tab body for a single scan: stats grid, MV banner +
 * filter chips when an MV scan exists, sorted violations, then a collapsed
 * passes section. Reads MV state from the closure for parity with the
 * production caller; the violation-shape and stat math is fully testable
 * via the result argument.
 */
export function renderResults(
  result: iScanResult,
  mvResult: iMultiViewportResult | null = null,
  mvFilter: number | null = null,
): string {
  // Determine which violations to display based on MV filter (F02)
  let displayViolations = result.violations;
  if (mvResult && mvFilter !== null) {
    const perViewportResult = mvResult.perViewport[mvFilter];
    displayViolations = perViewportResult ? perViewportResult.violations : [];
  }

  const totalPasses = result.passes.length;
  const totalRules = displayViolations.length + totalPasses;
  const passRate = totalRules > 0 ? Math.round((totalPasses / totalRules) * 100) : 100;
  const totalViolationNodes = displayViolations.reduce((sum, v) => sum + v.nodes.length, 0);

  // Map of viewport-specific violation id → viewport widths for badge rendering
  const viewportSpecificMap = new Map(mvResult ? mvResult.viewportSpecific.map((v) => [v.id, v.viewports]) : []);

  // MV summary banner and filter chips (F02-AC10, AC11)
  const mvBanner = mvResult ? `
    <div style="padding:var(--ds-space-3) var(--ds-space-5);background:var(--ds-amber-100);border:1px solid var(--ds-amber-300);border-radius:6px;margin-bottom:6px;font-size:11px;font-weight:600;color:var(--ds-amber-800)">
      Multi-Viewport: ${mvResult.shared.length} shared &middot; ${mvResult.viewportSpecific.length} viewport-specific
    </div>
    <div style="display:flex;gap:var(--ds-space-2);flex-wrap:wrap;margin-bottom:8px">
      <button class="mv-filter-chip cur-pointer min-h-24" data-mvfilter="all" aria-pressed="${mvFilter === null}" aria-label="Show violations for all viewports" style="font-size:11px;font-weight:700;padding:3px var(--ds-space-4);border-radius:var(--ds-radius-3);border:1px solid ${mvFilter === null ? "var(--ds-amber-600)" : "var(--ds-zinc-300)"};background:${mvFilter === null ? "var(--ds-amber-100)" : "#fff"};color:${mvFilter === null ? "var(--ds-amber-800)" : "var(--ds-zinc-600)"}">All</button>
      ${mvResult.viewports.map((vp) => `<button class="mv-filter-chip font-mono cur-pointer min-h-24" data-mvfilter="${vp}" aria-pressed="${mvFilter === vp}" aria-label="Show violations only at ${vp} pixel viewport" style="font-size:11px;font-weight:700;padding:3px var(--ds-space-4);border-radius:var(--ds-radius-3);border:1px solid ${mvFilter === vp ? "var(--ds-amber-600)" : "var(--ds-zinc-300)"};background:${mvFilter === vp ? "var(--ds-amber-100)" : "#fff"};color:${mvFilter === vp ? "var(--ds-amber-800)" : "var(--ds-zinc-600)"}">${vp}px</button>`).join("")}
    </div>
  ` : "";

  return `
    <div class="scan-pane">
      ${mvBanner}
      <div class="scan-stats-grid scan-stats-grid--4">
        <div><div style="font-size:16px;font-weight:800;color:var(--ds-red-700)">${totalViolationNodes}</div><div class="scan-caption-strong">Violations</div></div>
        <div><div style="font-size:16px;font-weight:800;color:var(--ds-green-700)">${result.passes.length}</div><div class="scan-caption-strong">Passes</div></div>
        <div><div style="font-size:16px;font-weight:800;color:var(--ds-amber-700)">${result.incomplete.length}</div><div class="scan-caption-strong">Review</div></div>
        <div><div style="font-size:16px;font-weight:800;color:var(--ds-zinc-700)">${passRate}%</div><div class="scan-caption-strong">Pass rate</div></div>
      </div>

      ${displayViolations
        .sort((a, b) => severityOrder(a.impact) - severityOrder(b.impact))
        .map((v) => {
          const vpWidths = viewportSpecificMap.has(v.id) ? (viewportSpecificMap.get(v.id) ?? null) : null;
          return renderViolation(v, vpWidths);
        })
        .join("")}

      <details style="margin-top:8px">
        <summary class="cur-pointer" style="list-style:none;font-size:12px;font-weight:700;color:var(--ds-green-700);padding:var(--ds-space-3) 0;display:flex;align-items:center;gap:var(--ds-space-3)">
          <svg aria-hidden="true" class="chevron fs-0" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="transition:transform 0.15s"><path d="M2 4l3 3 3-3"/></svg>
          <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 6l3 3 5-5"/></svg>
          ${result.passes.length} rules passed
        </summary>
        <div>
          ${result.passes.map((p) => `
            <details style="border-bottom:1px solid var(--ds-zinc-100)">
              <summary class="cur-pointer" style="list-style:none;display:flex;align-items:center;gap:var(--ds-space-4);padding:var(--ds-space-2) var(--ds-space-4);font-size:11px">
                <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
                <svg aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="#059669" stroke-width="1.5" stroke-linecap="round" class="fs-0"><path d="M1.5 5l2.5 2.5 4.5-4.5"/></svg>
                <span class="truncate f-1" style="font-weight:600;color:var(--ds-zinc-800)">${p.id}</span>
                <span class="fs-0" style="color:var(--ds-zinc-500)">${p.wcagCriteria?.join(", ") || ""}</span>
                <span class="fs-0" style="color:var(--ds-green-700);font-weight:700">${p.nodes.length}</span>
              </summary>
              <div style="padding:var(--ds-space-1) var(--ds-space-4) var(--ds-space-3) 28px">
                <div style="font-size:11px;color:var(--ds-zinc-600);margin-bottom:4px">${escHtml(p.description)}</div>
                ${p.nodes.map((n) => `
                  <div class="font-mono" style="font-size:11px;color:var(--ds-green-700);padding:var(--ds-space-1) var(--ds-space-4);margin:1px 0;background:var(--ds-green-50);border-radius:var(--ds-radius-2);display:flex;align-items:center;gap:var(--ds-space-3);overflow:hidden">
                    <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" class="fs-0"><path d="M1 4l2 2 4-4"/></svg>
                    <span class="truncate">${escHtml(n.selector)}</span>
                  </div>
                `).join("")}
              </div>
            </details>
          `).join("")}
        </div>
      </details>
    </div>
  `;
}

/** Render one violation row with its nodes + Highlight + Chat-about-it controls. */
export function renderViolation(v: iScanResult["violations"][0], viewportWidths: number[] | null = null): string {
  // Viewport-specific badge shown when violation only appears at some widths (F02-AC13)
  const vpBadge = viewportWidths && viewportWidths.length > 0
    ? viewportWidths.map((w) => `<span class="font-mono" style="font-size:10px;font-weight:700;padding:1px var(--ds-space-2);background:var(--ds-blue-100);color:var(--ds-sky-700);border-radius:var(--ds-radius-2);margin-left:2px">${w}px</span>`).join("")
    : "";
  return `
    <details class="severity-${v.impact} sr-details" style="border-radius:0 var(--ds-radius-3) var(--ds-radius-3) 0;margin-bottom:4px">
      <summary class="scan-detail-summary">
        <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
        <b class="truncate f-1" style="color:var(--ds-zinc-900)">${v.wcagCriteria?.join(", ") || v.id}${vpBadge}</b>
        <span class="fs-0" style="font-weight:700;padding:var(--ds-space-1) var(--ds-space-3);border-radius:var(--ds-radius-3);font-size:11px">${v.impact}</span>
        <span class="fs-0 font-mono" style="color:var(--ds-zinc-600);font-weight:700">${v.nodes.length}</span>
      </summary>
      <div class="scan-detail-body">
        ${v.wcagCriteria && v.wcagCriteria.length > 0 ? `<div style="margin-bottom:6px">${v.wcagCriteria.map((c) => `<a href="${getWcagUrl(c)}" target="_blank" rel="noopener" style="font-size:11px;font-weight:700;color:var(--ds-indigo-700);text-decoration:underline;margin-right:8px">${c} — Learn more ↗</a>`).join("")}</div>` : ""}
        ${v.nodes.map((n) => `
          <div style="background:#fff;border:1px solid var(--ds-zinc-200);border-radius:var(--ds-radius-3);padding:var(--ds-space-3);margin-bottom:4px;font-size:11px">
            <div style="display:flex;justify-content:space-between;gap:var(--ds-space-2)">
              <span class="truncate font-mono" style="font-weight:600;color:var(--ds-zinc-800)">${escHtml(n.selector)}</span>
              <button class="highlight-btn fs-0 cur-pointer min-h-24" data-selector="${escHtml(n.selector)}" aria-label="Highlight ${escHtml(n.selector)} on the page" style="font-size:11px;font-weight:700;color:var(--ds-amber-700);background:none;border:none">Highlight</button>
            </div>
            <div style="color:var(--ds-red-700);margin-top:2px">${escHtml(n.failureSummary)}</div>
            <button class="explain-btn cur-pointer min-h-24" data-rule="${v.id}" data-description="${escHtml(v.description)}" style="display:none;font-size:11px;font-weight:700;color:var(--ds-indigo-700);background:none;border:none;margin-top:4px">Chat about it →</button>
          </div>
        `).join("")}
      </div>
    </details>
  `;
}

/**
 * Render the crawl-results table. Supports two view modes:
 * - "page": one row per crawled URL with violation count + collapsible body
 * - "wcag": violations grouped by WCAG criterion across all pages
 */
export function renderCrawlResultsHtml(
  results: Record<string, iScanResult>,
  failed: Record<string, string>,
  crawlViewMode: "page" | "wcag",
): string {
  const allUrls = [...Object.keys(results), ...Object.keys(failed).filter((u) => !(u in results))];

  const toggle = `
    <div role="group" aria-label="Group crawl results by" style="display:flex;gap:0;border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);overflow:hidden;margin-bottom:8px">
      <button type="button" id="crawl-view-page" aria-pressed="${crawlViewMode === "page"}"
        class="f-1 cur-pointer min-h-24" style="padding:var(--ds-space-2) var(--ds-space-4);font-size:11px;font-weight:700;border:none;background:${crawlViewMode === "page" ? "var(--ds-amber-100)" : "#fff"};color:${crawlViewMode === "page" ? "var(--ds-amber-800)" : "var(--ds-zinc-600)"}">By page</button>
      <button type="button" id="crawl-view-wcag" aria-pressed="${crawlViewMode === "wcag"}"
        class="f-1 cur-pointer min-h-24" style="padding:var(--ds-space-2) var(--ds-space-4);font-size:11px;font-weight:700;border:none;border-left:1px solid var(--ds-zinc-300);background:${crawlViewMode === "wcag" ? "var(--ds-amber-100)" : "#fff"};color:${crawlViewMode === "wcag" ? "var(--ds-amber-800)" : "var(--ds-zinc-600)"}">By WCAG</button>
    </div>
  `;

  const totalViolations = Object.values(results).reduce((sum, r) => sum + r.violations.reduce((s, v) => s + v.nodes.length, 0), 0);
  const totalFailed = Object.keys(failed).length;
  const summary = `
    <div class="scan-stats-grid scan-stats-grid--3">
      <div><div style="font-size:15px;font-weight:800;color:var(--ds-zinc-800)">${allUrls.length}</div><div class="scan-sublabel">Pages</div></div>
      <div><div style="font-size:15px;font-weight:800;color:var(--ds-red-700)">${totalViolations}</div><div class="scan-sublabel">Violations</div></div>
      <div><div style="font-size:15px;font-weight:800;color:var(--ds-red-600)">${totalFailed}</div><div class="scan-sublabel">Failed</div></div>
    </div>
  `;

  let body = "";
  if (crawlViewMode === "page") {
    body = allUrls.map((url) => {
      const r = results[url];
      const err = failed[url];
      if (err) {
        return `
          <details style="border:1px solid var(--ds-red-200);border-radius:var(--ds-radius-3);margin-bottom:4px;background:var(--ds-red-50)">
            <summary class="scan-detail-summary">
              <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
              <span class="fs-0" style="color:var(--ds-red-600);font-weight:700">✗</span>
              <span class="truncate f-1 font-mono" style="color:var(--ds-zinc-800)" title="${escHtml(url)}">${escHtml(url)}</span>
            </summary>
            <div style="padding:var(--ds-space-2) var(--ds-space-4) var(--ds-space-4);font-size:11px;color:var(--ds-red-700)">${escHtml(err)}</div>
          </details>
        `;
      }
      const violationCount = r.violations.reduce((s, v) => s + v.nodes.length, 0);
      const passCount = r.passes.length;
      const hasViolations = violationCount > 0;
      return `
        <details style="border:1px solid ${hasViolations ? "var(--ds-red-200)" : "var(--ds-green-200)"};border-radius:4px;margin-bottom:4px;background:${hasViolations ? "var(--ds-red-50)" : "var(--ds-green-50)"}">
          <summary class="scan-detail-summary">
            <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
            <span class="fs-0" style="color:${hasViolations ? "var(--ds-red-600)" : "var(--ds-green-700)"};font-weight:700">${hasViolations ? "✗" : "✓"}</span>
            <span class="truncate f-1 font-mono" style="color:var(--ds-zinc-800)" title="${escHtml(url)}">${escHtml(url)}</span>
            <span class="fs-0" style="font-size:10px;font-weight:700;color:${hasViolations ? "var(--ds-red-700)" : "var(--ds-green-700)"}">${hasViolations ? violationCount + " issue" + (violationCount === 1 ? "" : "s") : passCount + " pass"}</span>
          </summary>
          <div class="scan-detail-body">
            ${r.violations.sort((a, b) => severityOrder(a.impact) - severityOrder(b.impact)).map((v) => renderViolation(v)).join("") || '<div style="font-size:11px;color:var(--ds-green-700);padding:var(--ds-space-2) 0">No violations found.</div>'}
          </div>
        </details>
      `;
    }).join("");
  } else {
    // By WCAG — group all violations across all pages by criterion
    const byCriterion = new Map<string, { violation: iScanResult["violations"][0]; pages: string[] }[]>();
    for (const [url, r] of Object.entries(results)) {
      for (const v of r.violations) {
        const criteria = v.wcagCriteria && v.wcagCriteria.length > 0 ? v.wcagCriteria : [v.id];
        for (const criterion of criteria) {
          if (!byCriterion.has(criterion)) byCriterion.set(criterion, []);
          byCriterion.get(criterion)!.push({ violation: v, pages: [url] });
        }
      }
    }

    if (byCriterion.size === 0) {
      body = '<div style="padding:var(--ds-space-6);font-size:12px;color:var(--ds-green-700);font-weight:600;text-align:center">No violations found across all pages.</div>';
    } else {
      body = Array.from(byCriterion.entries()).map(([criterion, entries]) => {
        const totalNodes = entries.reduce((s, e) => s + e.violation.nodes.length, 0);
        const uniquePages = [...new Set(entries.map((e) => e.pages[0]))];
        return `
          <details class="severity-${entries[0].violation.impact}" style="border-radius:0 var(--ds-radius-3) var(--ds-radius-3) 0;margin-bottom:4px">
            <summary class="scan-detail-summary">
              <svg class="chevron" aria-hidden="true" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4l3 3 3-3"/></svg>
              <b class="truncate f-1" style="color:var(--ds-zinc-900)">
                <a href="https://a11yscan.yantrakit.com/wcag/${criterion}" target="_blank" rel="noopener" style="color:var(--ds-indigo-700);text-decoration:underline">${criterion}</a>
              </b>
              <span class="fs-0" style="font-size:10px;color:var(--ds-zinc-600)">${uniquePages.length} page${uniquePages.length === 1 ? "" : "s"}</span>
              <span class="fs-0 font-mono" style="color:var(--ds-zinc-600);font-weight:700">${totalNodes}</span>
            </summary>
            <div class="scan-detail-body">
              ${uniquePages.map((pageUrl) => {
                const pageEntries = entries.filter((e) => e.pages[0] === pageUrl);
                return `
                  <div style="margin-bottom:4px">
                    <div class="truncate font-mono" style="font-size:10px;color:var(--ds-zinc-600)margin-bottom:2px" title="${escHtml(pageUrl)}">${escHtml(pageUrl)}</div>
                    ${pageEntries.map((e) => renderViolation(e.violation)).join("")}
                  </div>
                `;
              }).join("")}
            </div>
          </details>
        `;
      }).join("");
    }
  }

  return `<div class="scan-pane">${toggle}${summary}${body}</div>`;
}
