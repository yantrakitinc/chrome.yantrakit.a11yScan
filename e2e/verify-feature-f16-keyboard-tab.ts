/**
 * Verify: F16 keyboard tab.
 * Inventory: docs/test-matrix/features/f16-keyboard-tab.md
 *
 * Asserts:
 *  - KB tab baseline: kb-analyze + kb-clear (when analyzed) controls
 *  - kb-analyze populates rows for tab-order + focus-gaps + focus-indicators
 *    + skip-links sections (any of these populated = success)
 *  - kb-clear resets to un-analyzed state
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <a href="#main">Skip to main</a>
  <h1>F16 fixture</h1>
  <button id="b1">First</button>
  <button id="b2" tabindex="2">Second (positive tabindex)</button>
  <button id="b3" tabindex="-1">Hidden from Tab</button>
  <a href="#" id="a1">Link</a>
  <main id="main">Main content</main>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-kb") as HTMLButtonElement).click());
    await sleep(400);

    const baseline = await ctx.sidepanel.evaluate(() => ({
      hasAnalyze: !!document.getElementById("kb-analyze"),
    }));
    if (!baseline.hasAnalyze) ctx.fail({ step: "KB baseline", expected: "#kb-analyze", actual: "missing" });

    await ctx.sidepanel.evaluate(() => (document.getElementById("kb-analyze") as HTMLButtonElement).click());
    const deadline = Date.now() + 8000;
    let snap = { totalRows: 0, hasClear: false };
    while (Date.now() < deadline) {
      snap = await ctx.sidepanel.evaluate(() => {
        // Count any rows produced by analysis — different sections use different
        // class names; query broadly.
        const rows = document.querySelectorAll(
          "[data-kb-index], .kb-row, .kb-element-row, .kb-tab-row, .kb-focus-gap, .kb-skip-link"
        ).length;
        return { totalRows: rows, hasClear: !!document.getElementById("kb-clear") };
      });
      if (snap.totalRows > 0 || snap.hasClear) break;
      await sleep(120);
    }
    if (snap.totalRows === 0 && !snap.hasClear) {
      ctx.fail({ step: "kb-analyze", expected: "≥1 KB row OR #kb-clear within 8s", actual: "neither" });
    }

    if (snap.hasClear) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("kb-clear") as HTMLButtonElement).click());
      await sleep(400);
      const cleared = await ctx.sidepanel.evaluate(() => ({
        hasClear: !!document.getElementById("kb-clear"),
        rows: document.querySelectorAll("[data-kb-index], .kb-row, .kb-element-row, .kb-tab-row, .kb-focus-gap, .kb-skip-link").length,
      }));
      if (cleared.hasClear) ctx.fail({ step: "kb-clear", expected: "#kb-clear hidden after clear", actual: "still rendered" });
      if (cleared.rows !== 0) ctx.fail({ step: "kb-clear", expected: "rows wiped", actual: String(cleared.rows) });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f16-keyboard-tab");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
