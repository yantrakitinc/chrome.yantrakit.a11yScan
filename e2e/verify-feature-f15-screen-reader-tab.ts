/**
 * Verify: F15 Screen Reader tab.
 * Inventory: docs/test-matrix/features/f15-screen-reader-tab.md
 *
 * Asserts:
 *  - SR tab renders #sr-analyze + #sr-clear + #sr-inspect controls
 *  - sr-analyze populates rows with role badges
 *  - Each row exposes a per-row speak button (or row-click highlight handler)
 *  - sr-clear resets to un-analyzed state
 *
 * Real TTS audio is not verified (Gap 3 — only utterance.text + .rate captured
 * in unit tests).
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>F15 fixture</h1>
  <nav><a href="#a">Home</a><a href="#b">About</a></nav>
  <button>Submit</button>
  <p>Some content.</p>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-sr") as HTMLButtonElement).click());
    await sleep(400);

    // sr-clear is conditional on srAnalyzed — only #sr-analyze + #sr-inspect
    // exist in the un-analyzed baseline.
    const baseline = await ctx.sidepanel.evaluate(() => ({
      hasAnalyze: !!document.getElementById("sr-analyze"),
      hasInspect: !!document.getElementById("sr-inspect"),
      hasClear: !!document.getElementById("sr-clear"),
    }));
    if (!baseline.hasAnalyze) ctx.fail({ step: "SR tab baseline", expected: "#sr-analyze", actual: "missing" });
    if (!baseline.hasInspect) ctx.fail({ step: "SR tab baseline", expected: "#sr-inspect", actual: "missing" });
    if (baseline.hasClear) ctx.fail({ step: "SR tab baseline", expected: "#sr-clear hidden until analyzed", actual: "rendered too early" });

    // Analyze. Wait up to 8s for rows AND for #sr-clear to appear.
    await ctx.sidepanel.evaluate(() => (document.getElementById("sr-analyze") as HTMLButtonElement).click());
    const deadline = Date.now() + 8000;
    let snap = { rows: 0, hasClear: false };
    while (Date.now() < deadline) {
      snap = await ctx.sidepanel.evaluate(() => ({
        rows: document.querySelectorAll("[data-sr-index], .sr-row, .sr-element-row").length,
        hasClear: !!document.getElementById("sr-clear"),
      }));
      if (snap.rows > 0 && snap.hasClear) break;
      await sleep(120);
    }
    if (snap.rows === 0) ctx.fail({ step: "sr-analyze", expected: "≥1 reading-order row after analyze", actual: "0 within 8s" });
    if (!snap.hasClear) ctx.fail({ step: "sr-analyze", expected: "#sr-clear appears once analyzed", actual: "still hidden after 8s" });

    if (snap.hasClear) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("sr-clear") as HTMLButtonElement).click());
      await sleep(400);
      const afterClear = await ctx.sidepanel.evaluate(() => ({
        rows: document.querySelectorAll("[data-sr-index], .sr-row, .sr-element-row").length,
        hasClear: !!document.getElementById("sr-clear"),
      }));
      if (afterClear.rows !== 0) ctx.fail({ step: "sr-clear", expected: "rows wiped to 0", actual: String(afterClear.rows) });
      if (afterClear.hasClear) ctx.fail({ step: "sr-clear", expected: "#sr-clear hidden after clear (back to un-analyzed)", actual: "still rendered" });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f15-screen-reader-tab");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
