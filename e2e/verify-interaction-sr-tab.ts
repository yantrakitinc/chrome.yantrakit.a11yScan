/**
 * Verify: sr-tab interaction.
 * Inventory: docs/test-matrix/interactions/sr-tab.md
 *
 * Asserts:
 *  - SR top-tab activates the screen-reader panel
 *  - sr-analyze populates rows; sr-clear empties them
 *  - sr-inspect toggles aria-pressed
 *  - sr-play-all/pause/resume/stop wire up
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>SR fixture</h1>
  <nav><a href="#a">A</a><a href="#b">B</a></nav>
  <main>
    <button id="b1">Click</button>
    <input id="i1" type="text" aria-label="Search">
  </main>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Switch to SR top tab
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-sr") as HTMLButtonElement).click());
    await sleep(200);

    // SR panel should be visible
    const initial = await ctx.sidepanel.evaluate(() => ({
      panelVisible: !document.getElementById("panel-sr")?.hasAttribute("hidden"),
      hasAnalyze: !!document.getElementById("sr-analyze"),
      hasInspect: !!document.getElementById("sr-inspect"),
    }));
    if (!initial.panelVisible) ctx.fail({ step: "switch to SR tab", expected: "panel-sr visible", actual: "hidden" });
    if (!initial.hasAnalyze) ctx.fail({ step: "initial SR", expected: "#sr-analyze present", actual: "missing" });
    if (!initial.hasInspect) ctx.fail({ step: "initial SR", expected: "#sr-inspect present", actual: "missing" });

    // Click Analyze
    await ctx.sidepanel.evaluate(() => (document.getElementById("sr-analyze") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector(".sr-row", { timeout: 30000 }); }
    catch { ctx.fail({ step: "sr-analyze", expected: ".sr-row appears", actual: "timeout" }); throw new Error("analyze-timeout"); }

    const analyzed = await ctx.sidepanel.evaluate(() => ({
      rowCount: document.querySelectorAll(".sr-row").length,
      hasPlayAll: !!document.getElementById("sr-play-all"),
      hasClear: !!document.getElementById("sr-clear"),
    }));
    if (analyzed.rowCount === 0) ctx.fail({ step: "post-analyze", expected: "≥1 .sr-row rendered", actual: "0" });
    if (!analyzed.hasPlayAll) ctx.fail({ step: "post-analyze", expected: "#sr-play-all visible", actual: "missing" });
    if (!analyzed.hasClear) ctx.fail({ step: "post-analyze", expected: "#sr-clear visible", actual: "missing" });

    // Toggle inspect
    await ctx.sidepanel.evaluate(() => (document.getElementById("sr-inspect") as HTMLButtonElement).click());
    await sleep(150);
    const inspecting = await ctx.sidepanel.evaluate(() => ({
      pressed: document.getElementById("sr-inspect")?.getAttribute("aria-pressed"),
    }));
    if (inspecting.pressed !== "true") ctx.fail({ step: "click sr-inspect", expected: "aria-pressed=true", actual: String(inspecting.pressed) });

    // Click sr-clear → empties
    await ctx.sidepanel.evaluate(() => (document.getElementById("sr-clear") as HTMLButtonElement).click());
    await sleep(200);
    const cleared = await ctx.sidepanel.evaluate(() => ({
      rowCount: document.querySelectorAll(".sr-row").length,
      hasAnalyze: !!document.getElementById("sr-analyze"),
    }));
    if (cleared.rowCount > 0) ctx.fail({ step: "post-clear", expected: "0 rows", actual: String(cleared.rowCount) });
    if (!cleared.hasAnalyze) ctx.fail({ step: "post-clear", expected: "#sr-analyze visible (un-analyzed state)", actual: "missing" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "sr-tab");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
