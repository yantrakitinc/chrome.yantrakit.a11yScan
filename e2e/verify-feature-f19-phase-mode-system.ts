/**
 * Verify: F19 phase / mode system.
 * Inventory: docs/test-matrix/features/f19-phase-mode-system.md
 *
 * Asserts the (mode → button label) mapping at idle:
 *  - default (no mode): scan-btn label = "Scan Page"
 *  - mv ON: label = something with "Multi-Viewport" or "Viewport"
 *  - crawl ON: label = "Start Crawl"
 *
 * Also verifies that during scanning, scan-btn is disabled and progress card
 * appears.
 *
 * Per-state-combination unit testing for computeActionButtonText is exhaustive
 * in src/sidepanel/__tests__/compute-action-button-text.test.ts.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F19 fixture</h1><img src="/x.jpg"></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await sleep(500);

    // 1. Default idle
    const idle = await ctx.sidepanel.evaluate(() => ({
      label: (document.getElementById("scan-btn") as HTMLButtonElement | null)?.textContent?.trim() ?? "",
      disabled: (document.getElementById("scan-btn") as HTMLButtonElement | null)?.disabled ?? false,
    }));
    if (!/Scan Page/i.test(idle.label)) ctx.fail({ step: "idle label", expected: "scan-btn label 'Scan Page'", actual: idle.label });
    if (idle.disabled) ctx.fail({ step: "idle state", expected: "scan-btn enabled at idle", actual: "disabled" });

    // 2. Toggle MV → label changes
    await ctx.sidepanel.evaluate(() => (document.getElementById("mv-check") as HTMLInputElement).click());
    await sleep(200);
    const mv = await ctx.sidepanel.evaluate(() =>
      (document.getElementById("scan-btn") as HTMLButtonElement | null)?.textContent?.trim() ?? ""
    );
    if (!/Multi-?Viewport|Viewport/i.test(mv) && !/Scan All/i.test(mv)) {
      ctx.fail({ step: "MV idle label", expected: "label mentions Multi-Viewport / Viewport / 'Scan All'", actual: mv });
    }

    // Toggle MV off
    await ctx.sidepanel.evaluate(() => (document.getElementById("mv-check") as HTMLInputElement).click());
    await sleep(200);

    // 3. Toggle crawl → label flips to Start Crawl
    await ctx.sidepanel.evaluate(() => (document.querySelector('.mode-btn[data-mode="crawl"]') as HTMLButtonElement | null)?.click());
    await sleep(200);
    const crawl = await ctx.sidepanel.evaluate(() =>
      (document.getElementById("scan-btn") as HTMLButtonElement | null)?.textContent?.trim() ?? ""
    );
    if (!/Start Crawl/i.test(crawl)) ctx.fail({ step: "crawl idle label", expected: "label 'Start Crawl'", actual: crawl });

    // Toggle crawl off
    await ctx.sidepanel.evaluate(() => (document.querySelector('.mode-btn[data-mode="crawl"]') as HTMLButtonElement | null)?.click());
    await sleep(200);

    // 4. During scanning: button disabled + cancel-scan button visible
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    await sleep(150);
    const scanning = await ctx.sidepanel.evaluate(() => ({
      disabled: (document.getElementById("scan-btn") as HTMLButtonElement | null)?.disabled ?? false,
      hasCancel: !!document.getElementById("cancel-scan"),
    }));
    if (!scanning.disabled) ctx.fail({ step: "scanning phase", expected: "scan-btn disabled while scanning", actual: "still enabled" });
    if (!scanning.hasCancel) ctx.fail({ step: "scanning phase", expected: "#cancel-scan during scanning", actual: "missing" });

    // 5. After results: sub-tabs visible + Clear button
    await ctx.sidepanel.waitForSelector("#export-json", { timeout: 30000 });
    const results = await ctx.sidepanel.evaluate(() => ({
      hasResultsSub: !!document.querySelector('[data-subtab="results"]'),
      hasManualSub: !!document.querySelector('[data-subtab="manual"]'),
      hasAriaSub: !!document.querySelector('[data-subtab="aria"]'),
      hasClear: !!document.getElementById("clear-btn"),
      hasToolbar: !!document.getElementById("toggle-violations"),
    }));
    if (!results.hasResultsSub) ctx.fail({ step: "results phase", expected: "Results sub-tab", actual: "missing" });
    if (!results.hasManualSub) ctx.fail({ step: "results phase", expected: "Manual sub-tab", actual: "missing" });
    if (!results.hasAriaSub) ctx.fail({ step: "results phase", expected: "ARIA sub-tab", actual: "missing" });
    if (!results.hasClear) ctx.fail({ step: "results phase", expected: "#clear-btn", actual: "missing" });
    if (!results.hasToolbar) ctx.fail({ step: "results phase", expected: "highlight toolbar #toggle-violations", actual: "missing" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f19-phase-mode-system");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
