/**
 * Verify flow: cancel a running crawl mid-page → state resets cleanly.
 * Inventory: docs/test-matrix/flows/crawl-cancel-mid-page.md
 *
 * Steps:
 *  1. Start a crawl (with an unresolvable URL → real crawl backend stays busy
 *     for at least a few hundred ms before failing).
 *  2. Click cancel-crawl during the brief crawling window.
 *  3. Verify state resets — scan-btn label back to 'Start Crawl', no
 *     pause-crawl/cancel-crawl in DOM, no leftover progress bar.
 *  4. Click scan-btn again — fresh crawl starts cleanly (no stale state).
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>crawl-cancel fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Toggle Crawl mode + urllist + add 2 URLs
    await ctx.sidepanel.evaluate(() => (document.querySelector('.mode-btn[data-mode="crawl"]') as HTMLButtonElement | null)?.click());
    await sleep(150);
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
      inp.value = "http://127.0.0.1:1/never-resolves-1";
    });
    await ctx.sidepanel.evaluate(() => (document.getElementById("url-manual-add") as HTMLButtonElement).click());
    await sleep(150);
    await ctx.sidepanel.evaluate(() => {
      const inp = document.getElementById("url-manual-input") as HTMLInputElement;
      inp.value = "http://127.0.0.1:1/never-resolves-2";
    });
    await ctx.sidepanel.evaluate(() => (document.getElementById("url-manual-add") as HTMLButtonElement).click());
    await sleep(200);

    // Start crawl
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());

    // Poll for cancel-crawl button to appear
    const deadline = Date.now() + 3000;
    let running = { hasCancel: false, hasPause: false };
    while (Date.now() < deadline) {
      running = await ctx.sidepanel.evaluate(() => ({
        hasCancel: !!document.getElementById("cancel-crawl"),
        hasPause: !!document.getElementById("pause-crawl"),
      }));
      if (running.hasCancel) break;
      await sleep(50);
    }
    if (!running.hasCancel) {
      ctx.fail({ step: "crawl start", expected: "#cancel-crawl visible during crawling", actual: "never appeared" });
      return;
    }
    if (!running.hasPause) ctx.fail({ step: "crawl start", expected: "#pause-crawl visible during crawling", actual: "missing" });

    // Click cancel-crawl
    await ctx.sidepanel.evaluate(() => (document.getElementById("cancel-crawl") as HTMLButtonElement).click());
    await sleep(500);

    const afterCancel = await ctx.sidepanel.evaluate(() => ({
      hasCancel: !!document.getElementById("cancel-crawl"),
      hasPause: !!document.getElementById("pause-crawl"),
      hasProgress: !!document.querySelector(".progress-bar, .progress-track"),
      scanBtnText: (document.getElementById("scan-btn") as HTMLButtonElement | null)?.textContent?.trim() ?? "",
    }));
    if (afterCancel.hasCancel) ctx.fail({ step: "post-cancel", expected: "#cancel-crawl removed", actual: "still rendered" });
    if (afterCancel.hasPause) ctx.fail({ step: "post-cancel", expected: "#pause-crawl removed", actual: "still rendered" });
    if (afterCancel.hasProgress) ctx.fail({ step: "post-cancel", expected: "no progress bar", actual: "still rendered" });
    if (!/Start Crawl/i.test(afterCancel.scanBtnText)) {
      ctx.fail({ step: "post-cancel", expected: "scan-btn label 'Start Crawl'", actual: afterCancel.scanBtnText });
    }

    // Restart — fresh crawl
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    const reDeadline = Date.now() + 3000;
    let running2 = { hasCancel: false };
    while (Date.now() < reDeadline) {
      running2 = await ctx.sidepanel.evaluate(() => ({
        hasCancel: !!document.getElementById("cancel-crawl"),
      }));
      if (running2.hasCancel) break;
      await sleep(50);
    }
    if (!running2.hasCancel) ctx.fail({ step: "re-start", expected: "fresh crawl shows #cancel-crawl", actual: "never appeared" });

    // Clean up — cancel the second crawl too
    if (running2.hasCancel) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("cancel-crawl") as HTMLButtonElement).click());
      await sleep(300);
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-crawl-cancel-mid-page");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
