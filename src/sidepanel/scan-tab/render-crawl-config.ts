/**
 * Pure renderers for the crawl-mode config row + URL-list editor panel.
 */

import { escHtml } from "@shared/utils";

/**
 * Render the crawl-config row: the Crawl mode dropdown (Follow / URL list)
 * plus, in URL-list mode, the open-list button and inline panel.
 */
export function renderCrawlConfigHtml(s: {
  crawlMode: "follow" | "urllist";
  urlListPanelOpen: boolean;
  urlList: string[];
  busy: boolean;
}): string {
  const urlCount = s.urlList.length;
  const urlListBtn = s.crawlMode === "urllist"
    ? `<button type="button" id="url-list-open" aria-expanded="${s.urlListPanelOpen}" aria-controls="url-list-panel"
        class="cur-pointer min-h-24" style="font-size:var(--ds-text-base);font-weight:700;padding:3px var(--ds-space-5);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);background:#fff;color:var(--ds-zinc-800);margin-top:var(--ds-space-2)">
        ${urlCount === 0 ? "Set up URL list" : `${urlCount} URL${urlCount === 1 ? "" : "s"} — Edit list`}
      </button>`
    : "";

  const panel = (s.crawlMode === "urllist" && s.urlListPanelOpen) ? renderUrlListPanelHtml(s.urlList) : "";

  return `
    <div style="display:flex;align-items:center;gap:var(--ds-space-4)">
      <span class="scan-caption-strong">Crawl mode</span>
      <select id="crawl-mode" aria-label="Crawl mode" ${s.busy ? "disabled" : ""} class="f-1" style="font-size:var(--ds-text-md);padding:var(--ds-space-2) var(--ds-space-4);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);font-weight:600">
        <option value="follow" ${s.crawlMode === "follow" ? "selected" : ""}>Follow all links</option>
        <option value="urllist" ${s.crawlMode === "urllist" ? "selected" : ""}>URL list</option>
      </select>
    </div>
    ${urlListBtn}
    ${panel}
  `;
}

/**
 * Render the URL-list editor panel: paste textarea + add buttons + the
 * read-only list rows.
 */
export function renderUrlListPanelHtml(urlList: string[]): string {
  const listRows = urlList.map((url, i) => `
    <div style="display:flex;align-items:center;gap:var(--ds-space-2);margin-bottom:3px">
      <input type="text" readonly value="${escHtml(url)}"
        class="f-1 font-mono" style="font-size:var(--ds-text-base);padding:3px var(--ds-space-3);border:1px solid var(--ds-zinc-200);border-radius:var(--ds-radius-2);background:var(--ds-zinc-50);color:var(--ds-zinc-800);min-width:0">
      <button type="button" class="url-remove-btn fs-0 cur-pointer min-h-24" data-index="${i}"
        aria-label="Remove URL"
        style="font-size:var(--ds-text-md);font-weight:700;color:var(--ds-red-700);background:none;border:none;padding:0 var(--ds-space-2)">&times;</button>
    </div>
  `).join("");

  const summary = urlList.length > 0
    ? `<div style="font-size:var(--ds-text-base);font-weight:600;color:var(--ds-zinc-600);margin-bottom:var(--ds-space-3)">${urlList.length} URL${urlList.length === 1 ? "" : "s"} will be scanned</div>`
    : "";

  return `
    <div id="url-list-panel" style="margin-top:var(--ds-space-3);border:1px solid var(--ds-zinc-300);border-radius:6px;background:var(--ds-zinc-50);padding:var(--ds-space-4)">
      <div style="font-size:var(--ds-text-base);font-weight:800;color:var(--ds-zinc-800);text-transform:uppercase;letter-spacing:0.05em;margin-bottom:var(--ds-space-4)">URL List</div>

      <div style="margin-bottom:var(--ds-space-4)">
        <textarea id="url-paste-area" rows="3" aria-label="Paste URLs or sitemap XML" placeholder="Paste URLs (one per line) or sitemap XML (&lt;?xml…)"
          class="font-mono" style="width:100%;box-sizing:border-box;font-size:var(--ds-text-base);padding:var(--ds-space-3);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);resize:vertical;background:#fff;color:var(--ds-zinc-800)"></textarea>
        <div style="display:flex;gap:var(--ds-space-2);margin-top:var(--ds-space-2);flex-wrap:wrap">
          <button type="button" id="url-paste-add"
            class="cur-pointer min-h-24" style="font-size:var(--ds-text-base);font-weight:700;padding:3px var(--ds-space-5);border:none;border-radius:var(--ds-radius-3);background:var(--ds-amber-500);color:var(--ds-amber-cta-fg)">Add from textarea</button>
          <label class="cur-pointer min-h-24" style="font-size:var(--ds-text-base);font-weight:700;padding:3px var(--ds-space-5);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);background:#fff;color:var(--ds-zinc-700);display:flex;align-items:center">
            Upload .txt
            <input type="file" id="url-file-input" accept=".txt,text/plain" style="position:absolute;width:1px;height:1px;opacity:0;overflow:hidden;clip:rect(0,0,0,0)">
          </label>
        </div>
      </div>

      <div style="display:flex;gap:var(--ds-space-2);margin-bottom:var(--ds-space-4)">
        <input type="url" id="url-manual-input" aria-label="Add URL to crawl list" placeholder="https://example.com/page"
          class="f-1" style="font-size:var(--ds-text-base);padding:var(--ds-space-2) var(--ds-space-3);border:1px solid var(--ds-zinc-300);border-radius:var(--ds-radius-3);background:#fff;color:var(--ds-zinc-800);min-width:0">
        <button type="button" id="url-manual-add"
          class="fs-0 cur-pointer min-h-24" style="font-size:var(--ds-text-base);font-weight:700;padding:3px var(--ds-space-5);border:none;border-radius:var(--ds-radius-3);background:var(--ds-amber-500);color:var(--ds-amber-cta-fg)">Add</button>
      </div>

      ${summary}
      <div id="url-list-rows" style="max-height:160px;overflow-y:auto">${listRows}</div>

      <button type="button" id="url-list-done"
        class="cur-pointer min-h-24" style="width:100%;margin-top:var(--ds-space-4);font-size:var(--ds-text-base);font-weight:800;padding:5px;border:none;border-radius:var(--ds-radius-3);background:var(--ds-amber-500);color:var(--ds-amber-cta-fg)">Done</button>
    </div>
  `;
}
