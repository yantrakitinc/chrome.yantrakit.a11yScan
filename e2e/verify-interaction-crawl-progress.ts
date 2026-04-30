/**
 * Verify: crawl-progress + page-rule-wait interactions.
 * Inventory: docs/test-matrix/interactions/crawl-progress.md
 *
 * Asserts (limited — full crawl flow needs pageRules + multi-URL fixture which is complex):
 *  - cancel-scan visible during scanning state with idle scan-btn (but cancel-scan is rendered when scan is mid-flight)
 *  - The PROGRESS UI elements (renderCrawlProgressHtml + renderPageRuleWaitHtml) are pure renderers covered by unit tests.
 *  - Real e2e crawl test requires a multi-URL HTTP fixture — deferred to a feature-level script.
 *
 * This script validates the simpler path: triggering crawl mode + Start Crawl renders the crawl-progress card.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";
import http from "http";
import type { AddressInfo } from "net";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Crawl progress fixture</h1><a href="/page2">page 2</a></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Enable crawl mode
    await ctx.sidepanel.evaluate(() => (document.querySelector('.mode-btn[data-mode="crawl"]') as HTMLButtonElement | null)?.click());
    await sleep(200);

    // Switch to urllist mode + add a URL
    await ctx.sidepanel.evaluate(() => {
      const sel = document.getElementById("crawl-mode") as HTMLSelectElement;
      sel.value = "urllist";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sleep(200);
    await ctx.sidepanel.evaluate(() => (document.getElementById("url-list-open") as HTMLButtonElement).click());
    await sleep(200);
    await ctx.sidepanel.evaluate(() => {
      const inp = document.getElementById("url-manual-input") as HTMLInputElement;
      inp.value = "http://127.0.0.1:1/never-resolves";
    });
    await ctx.sidepanel.evaluate(() => (document.getElementById("url-manual-add") as HTMLButtonElement).click());
    await sleep(200);

    // Click Start Crawl. With an unresolvable URL the background reports
    // CRAWL_PROGRESS status="complete" within a few hundred ms, transitioning
    // crawlPhase from "crawling" → "complete". Poll for the brief
    // crawling-phase UI window.
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());

    let state: {
      hasPauseCrawl: boolean;
      hasCancelCrawl: boolean;
      progressBar: boolean;
    } = { hasPauseCrawl: false, hasCancelCrawl: false, progressBar: false };

    const pollDeadline = Date.now() + 3000;
    while (Date.now() < pollDeadline) {
      state = await ctx.sidepanel.evaluate(() => ({
        hasPauseCrawl: !!document.getElementById("pause-crawl"),
        hasCancelCrawl: !!document.getElementById("cancel-crawl"),
        progressBar: !!document.querySelector(".progress-bar, .progress-track"),
      }));
      if (state.hasPauseCrawl && state.hasCancelCrawl) break;
      await sleep(50);
    }

    // The fixture URL is unresolvable so the crawl will hang on tab.update; that's OK,
    // we just need to verify the UI rendered the crawl-progress card.
    if (!state.hasPauseCrawl) ctx.fail({ step: "crawl start", expected: "#pause-crawl button visible during crawling", actual: "missing" });
    if (!state.hasCancelCrawl) ctx.fail({ step: "crawl start", expected: "#cancel-crawl button visible during crawling", actual: "missing" });

    // Click cancel to clean up
    if (state.hasCancelCrawl) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("cancel-crawl") as HTMLButtonElement).click());
      await sleep(500);
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "crawl-progress");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
