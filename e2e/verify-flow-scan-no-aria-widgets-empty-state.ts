/**
 * Verify flow: Scan a page with NO ARIA widgets → distinct post-scan empty state.
 * Inventory: docs/test-matrix/flows/scan-no-aria-widgets-empty-state.md
 *
 * NOTE: Sentinel-fails on main until PR #102 / #101 lands. Same regression as
 * verify-feature-f01 / verify-feature-f10 / verify-interaction-aria-tab.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>Plain page</h1>
  <p>No ARIA widgets here.</p>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Step 1: pre-scan empty state with #run-aria-scan + "scanned yet" copy
    await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="aria"]') as HTMLButtonElement | null)?.click());
    await sleep(300);
    const pre = await ctx.sidepanel.evaluate(() => {
      const html = document.querySelector("#scan-content")?.innerHTML || "";
      return {
        hasManual: !!document.getElementById("run-aria-scan"),
        hasScanedYet: html.includes("scanned yet"),
      };
    });
    if (!pre.hasManual) ctx.fail({ step: "pre-scan", expected: "#run-aria-scan visible before scan", actual: "missing" });
    if (!pre.hasScanedYet) ctx.fail({ step: "pre-scan", expected: "'scanned yet' phrasing before scan", actual: "missing" });

    // Step 2: scan
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 }); }
    catch { ctx.fail({ step: "scan", expected: "results", actual: "timeout" }); throw new Error("scan-timeout"); }
    await sleep(2500);

    await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="aria"]') as HTMLButtonElement).click());
    await sleep(400);

    // Step 3 (and 4): post-scan zero-result state
    const post = await ctx.sidepanel.evaluate(() => {
      const html = document.querySelector("#scan-content")?.innerHTML || "";
      return {
        hasManual: !!document.getElementById("run-aria-scan"),
        hasScanedYet: html.includes("scanned yet"),
        hasNoneDetected: /No ARIA widgets detected/i.test(html),
      };
    });
    if (post.hasManual) ctx.fail({ step: "post-scan zero", expected: "no #run-aria-scan after auto-scan", actual: "still present (PR #102 regression)" });
    if (post.hasScanedYet) ctx.fail({ step: "post-scan zero", expected: "no 'scanned yet' phrasing post-scan", actual: "phrase present" });
    if (!post.hasNoneDetected) ctx.fail({ step: "post-scan zero", expected: "'No ARIA widgets detected'", actual: "missing" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-scan-no-aria-widgets-empty-state");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
