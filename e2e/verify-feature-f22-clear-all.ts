/**
 * Verify: F22 Clear All.
 * Inventory: docs/test-matrix/features/f22-clear-all.md
 *
 * Asserts:
 *  - Clear button visible after a scan
 *  - Click Clear → state.scanPhase=idle (UI no longer shows results, scan-btn
 *    re-renders, accordion re-expanded)
 *  - Mode toggles preserved (Clear should NOT reset crawl/movie/observe/mv —
 *    that's Reset's job)
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F22 fixture</h1><img src="/x.jpg"></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Toggle MV ON to verify Clear preserves mode toggles
    await ctx.sidepanel.evaluate(() => (document.getElementById("mv-check") as HTMLInputElement).click());
    await sleep(150);

    // Scan
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector("#clear-btn", { timeout: 60000 });
    } catch {
      ctx.fail({ step: "scan", expected: "#clear-btn after results", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    const beforeClear = await ctx.sidepanel.evaluate(() => ({
      hasResults: !!document.querySelector("#scan-content details"),
      hasToolbar: !!document.getElementById("toggle-violations"),
      mvChecked: (document.getElementById("mv-check") as HTMLInputElement).checked,
    }));
    if (!beforeClear.hasResults) ctx.fail({ step: "pre-clear", expected: "results details rendered before clear", actual: "missing" });
    if (!beforeClear.hasToolbar) ctx.fail({ step: "pre-clear", expected: "toolbar rendered", actual: "missing" });
    if (!beforeClear.mvChecked) ctx.fail({ step: "pre-clear MV state", expected: "MV check on", actual: "off" });

    // Click Clear
    await ctx.sidepanel.evaluate(() => (document.getElementById("clear-btn") as HTMLButtonElement).click());
    await sleep(500);

    const afterClear = await ctx.sidepanel.evaluate(() => ({
      hasResults: !!document.querySelector("#scan-content details"),
      hasClearBtn: !!document.getElementById("clear-btn"),
      hasToolbar: !!document.getElementById("toggle-violations"),
      mvChecked: (document.getElementById("mv-check") as HTMLInputElement | null)?.checked ?? null,
      scanBtnText: (document.getElementById("scan-btn") as HTMLButtonElement | null)?.textContent?.trim() ?? "",
    }));
    if (afterClear.hasResults) ctx.fail({ step: "post-clear", expected: "results details wiped", actual: "still rendered" });
    if (afterClear.hasClearBtn) ctx.fail({ step: "post-clear", expected: "#clear-btn hidden after clear", actual: "still rendered" });
    if (afterClear.hasToolbar) ctx.fail({ step: "post-clear", expected: "toolbar hidden after clear", actual: "still rendered" });
    if (afterClear.mvChecked !== true) ctx.fail({ step: "post-clear MV preserved", expected: "MV remains checked (Clear should not reset modes)", actual: String(afterClear.mvChecked) });
    if (!/Scan/i.test(afterClear.scanBtnText)) ctx.fail({ step: "post-clear", expected: "scan-btn label mentions Scan", actual: afterClear.scanBtnText });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f22-clear-all");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
