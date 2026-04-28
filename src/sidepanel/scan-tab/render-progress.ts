/**
 * Pure progress-bar renderers: scan progress, crawl progress, page-rule
 * wait alert.
 */

import { escHtml } from "@shared/utils";

/** Render the scanning progress bar. */
export function renderScanProgressHtml(s: {
  mv: boolean;
  mvProgress: { current: number; total: number } | null;
  viewports: number[];
}): string {
  return `
    <div class="progress-bar" role="status" aria-live="polite" aria-atomic="true">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <span class="font-mono" style="font-size:11px;color:var(--ds-zinc-600)">${s.mv ? `viewport ${s.mvProgress ? `${s.mvProgress.current}/${s.mvProgress.total}` : `1/${s.viewports.length}`}` : "analyzing page…"}</span>
        <button id="cancel-scan" aria-label="Cancel scan" class="scan-progress-icon-btn scan-progress-icon-btn--danger">
          <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
        </button>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:60%;animation:pulse 1.5s ease infinite"></div></div>
    </div>
  `;
}

/**
 * Render the crawl progress bar. Shows pages-visited/total + current URL,
 * pause/resume button matching crawlPhase, and a percent-fill bar.
 */
export function renderCrawlProgressHtml(
  progress: { pagesVisited: number; pagesTotal: number; currentUrl: string },
  crawlPhase: "idle" | "crawling" | "wait" | "paused" | "complete",
): string {
  const { pagesVisited, pagesTotal, currentUrl } = progress;
  const pageLabel = pagesTotal > 0 ? `${pagesVisited}/${pagesTotal} pages` : "scanning…";
  const urlDisplay = currentUrl
    ? (() => { try { return new URL(currentUrl).pathname || currentUrl; } catch { return currentUrl; } })()
    : "";
  const progressPct = pagesTotal > 0 ? Math.round((pagesVisited / pagesTotal) * 100) : 42;
  return `
    <div class="progress-bar" role="status" aria-live="polite" aria-atomic="true">
      <div style="display:flex;align-items:center;margin-bottom:4px;gap:8px">
        <span class="fs-0 font-mono" style="font-size:11px;font-weight:700;color:var(--ds-zinc-600)">${pageLabel}</span>
        ${urlDisplay ? `<span class="truncate f-1 font-mono" style="font-size:10px;color:var(--ds-zinc-500);min-width:0" title="${escHtml(currentUrl)}">${escHtml(urlDisplay)}</span>` : ""}
        <div class="fs-0" style="display:flex;gap:4px">
          ${crawlPhase === "crawling"
            ? '<button id="pause-crawl" aria-label="Pause crawl" class="scan-progress-icon-btn"><svg aria-hidden="true" width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><rect width="3" height="10" rx=".5"/><rect x="5" width="3" height="10" rx=".5"/></svg></button>'
            : '<button id="resume-crawl" aria-label="Resume crawl" class="scan-progress-icon-btn"><svg aria-hidden="true" width="8" height="10" viewBox="0 0 8 10" fill="currentColor"><path d="M0 0l8 5-8 5z"/></svg></button>'
          }
          <button id="cancel-crawl" aria-label="Cancel crawl" class="scan-progress-icon-btn scan-progress-icon-btn--danger">
            <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M1 1l6 6M7 1L1 7"/></svg>
          </button>
        </div>
      </div>
      <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%${crawlPhase === "crawling" ? ";animation:pulse 1.5s ease infinite" : ""}"></div></div>
    </div>
  `;
}

/** Render the alert banner shown when a page rule pauses the crawl. */
export function renderPageRuleWaitHtml(info: { url: string; description: string; waitType?: string } | null): string {
  return `
    <div role="alert" aria-live="assertive" class="fs-0" style="padding:8px 12px;border-bottom:2px solid var(--ds-yellow-400);background:var(--ds-amber-50)">
      <div style="font-size:11px;font-weight:700;color:var(--ds-amber-900);margin-bottom:6px">⚠ Page rule triggered</div>
      ${info?.description ? `<div style="font-size:11px;color:var(--ds-zinc-800);margin-bottom:4px">${escHtml(info.description)}</div>` : ""}
      ${info?.url ? `<div class="truncate font-mono" style="font-size:10px;color:var(--ds-zinc-500);margin-bottom:6px" title="${escHtml(info.url)}">${escHtml(info.url)}</div>` : ""}
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button id="continue-crawl" class="cur-pointer min-h-24" style="padding:4px 10px;font-size:11px;font-weight:700;color:var(--ds-amber-cta-fg);background:var(--ds-amber-500);border:none;border-radius:4px">Continue</button>
        <button id="scan-then-continue" class="cur-pointer min-h-24" style="padding:4px 10px;font-size:11px;font-weight:700;color:var(--ds-zinc-700);background:#fff;border:1px solid var(--ds-zinc-300);border-radius:4px">Scan page, then continue</button>
        <button id="cancel-wait" class="cur-pointer min-h-24" style="font-size:11px;font-weight:700;color:var(--ds-red-600);background:none;border:1px solid var(--ds-red-200);border-radius:4px;margin-left:auto;padding:4px 10px">Cancel</button>
      </div>
    </div>
  `;
}
