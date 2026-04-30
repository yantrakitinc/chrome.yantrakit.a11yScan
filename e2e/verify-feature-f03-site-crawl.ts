/**
 * Verify: F03 site crawl.
 * Inventory: docs/test-matrix/features/f03-site-crawl.md
 *
 * Verifies the dispatch + UI flow:
 *  - Crawl mode toggle reveals crawl-config-panel + #crawl-mode dropdown
 *  - crawl-mode=urllist surfaces URL panel; manual + paste add populate the list
 *  - Click Scan Page (now "Start Crawl") with URLs → state transitions to
 *    crawling and renders pause/cancel buttons (briefly, polled)
 *  - cancel-crawl click resets the UI
 *
 * Auth + page-rule pause + crawl-results-by-page rendering are covered by unit
 * tests + the dedicated crawl-config-panel + crawl-progress interaction scripts.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F03 fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Toggle crawl mode
    await ctx.sidepanel.evaluate(() => (document.querySelector('.mode-btn[data-mode="crawl"]') as HTMLButtonElement | null)?.click());
    await sleep(200);
    const c1 = await ctx.sidepanel.evaluate(() => ({
      hasCrawlMode: !!document.getElementById("crawl-mode"),
      scanBtnLabel: (document.getElementById("scan-btn") as HTMLButtonElement | null)?.textContent?.trim() ?? "",
    }));
    if (!c1.hasCrawlMode) ctx.fail({ step: "crawl mode toggle", expected: "#crawl-mode dropdown rendered", actual: "missing" });
    if (!/Start Crawl/i.test(c1.scanBtnLabel)) ctx.fail({ step: "crawl mode toggle", expected: "scan-btn label 'Start Crawl'", actual: c1.scanBtnLabel });

    // Switch to urllist + add a URL
    await ctx.sidepanel.evaluate(() => {
      const sel = document.getElementById("crawl-mode") as HTMLSelectElement;
      sel.value = "urllist";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sleep(150);
    await ctx.sidepanel.evaluate(() => (document.getElementById("url-list-open") as HTMLButtonElement).click());
    await sleep(150);
    await ctx.sidepanel.evaluate(() => {
      const inp = document.getElementById("url-manual-input") as HTMLInputElement;
      inp.value = "http://127.0.0.1:1/never-resolves";
    });
    await ctx.sidepanel.evaluate(() => (document.getElementById("url-manual-add") as HTMLButtonElement).click());
    await sleep(150);

    const urlAdded = await ctx.sidepanel.evaluate(() => document.querySelectorAll(".url-remove-btn").length);
    if (urlAdded === 0) ctx.fail({ step: "url-list add", expected: "≥1 URL row", actual: "0" });

    // Start crawl. With unresolvable URL the crawl flips to complete fast — poll.
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    let running = { hasPauseCrawl: false, hasCancelCrawl: false };
    const deadline = Date.now() + 3000;
    while (Date.now() < deadline) {
      running = await ctx.sidepanel.evaluate(() => ({
        hasPauseCrawl: !!document.getElementById("pause-crawl"),
        hasCancelCrawl: !!document.getElementById("cancel-crawl"),
      }));
      if (running.hasPauseCrawl && running.hasCancelCrawl) break;
      await sleep(50);
    }
    if (!running.hasPauseCrawl) ctx.fail({ step: "crawl start", expected: "#pause-crawl during crawling", actual: "never appeared in 3s" });
    if (!running.hasCancelCrawl) ctx.fail({ step: "crawl start", expected: "#cancel-crawl during crawling", actual: "never appeared in 3s" });

    // Cancel: clicking #cancel-crawl resets crawlPhase to idle. The accordion
    // re-expand intent is set by the handler but a CRAWL_PROGRESS=complete
    // message can race in and overwrite it — verify only the scan-btn label
    // round-trip (most observable + race-free signal).
    if (running.hasCancelCrawl) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("cancel-crawl") as HTMLButtonElement).click());
      await sleep(400);
      const post = await ctx.sidepanel.evaluate(() => ({
        scanBtnLabel: (document.getElementById("scan-btn") as HTMLButtonElement | null)?.textContent?.trim() ?? "",
        pauseCrawlGone: !document.getElementById("pause-crawl"),
      }));
      if (!post.pauseCrawlGone) ctx.fail({ step: "cancel-crawl", expected: "#pause-crawl removed after cancel", actual: "still present" });
      if (!/Start Crawl/i.test(post.scanBtnLabel)) ctx.fail({ step: "cancel-crawl", expected: "scan-btn back to 'Start Crawl'", actual: post.scanBtnLabel });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f03-site-crawl");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
