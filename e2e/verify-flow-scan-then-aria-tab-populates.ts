/**
 * Verify flow: Scan Page → ARIA tab auto-populates with widgets.
 * Inventory: docs/test-matrix/flows/scan-then-aria-tab-populates.md
 *
 * Asserts the cumulative round-trip:
 *  - Scan a fixture WITH ARIA widgets
 *  - After scan completes, ARIA sub-tab shows widget rows
 *  - No "scanned yet" pre-scan empty-state phrasing
 *  - No #run-aria-scan manual button
 *  - At least 3 <details> rows for the 3 widgets
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <div role="tablist" aria-label="Settings">
    <button role="tab" aria-selected="true" aria-controls="p1">A</button>
    <button role="tab" aria-controls="p2">B</button>
  </div>
  <div role="dialog" aria-label="Confirm">
    <button>OK</button>
  </div>
  <div role="checkbox" aria-checked="false" tabindex="0">Subscribe</div>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 }); }
    catch { ctx.fail({ step: "scan", expected: "results render", actual: "timeout" }); throw new Error("scan-timeout"); }
    await sleep(2500);

    await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="aria"]') as HTMLButtonElement).click());
    await sleep(400);

    const out = await ctx.sidepanel.evaluate(() => {
      const html = document.querySelector("#scan-content")?.innerHTML || "";
      return {
        details: document.querySelectorAll("#scan-content details").length,
        hasManual: !!document.getElementById("run-aria-scan"),
        hasScanedYet: html.includes("scanned yet"),
      };
    });
    if (out.hasManual) ctx.fail({ step: "post-scan ARIA", expected: "no #run-aria-scan after scan", actual: "still present" });
    if (out.hasScanedYet) ctx.fail({ step: "post-scan ARIA", expected: "no 'scanned yet' phrasing post-scan", actual: "phrase present" });
    if (out.details < 3) ctx.fail({ step: "ARIA widget rows", expected: "≥3 details (tablist + dialog + checkbox)", actual: String(out.details) });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-scan-then-aria-tab-populates");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
