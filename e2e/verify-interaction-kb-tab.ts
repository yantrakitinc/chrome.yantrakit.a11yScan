/**
 * Verify: kb-tab interaction.
 * Inventory: docs/test-matrix/interactions/kb-tab.md
 *
 * Asserts:
 *  - Keyboard top-tab activates panel
 *  - kb-analyze populates tab-order rows + sections
 *  - kb-clear empties
 *  - movie-play-all + overlay toggles wire up
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>KB fixture</h1>
  <button id="b1">A</button>
  <a href="#" id="a1">B</a>
  <input id="i1">
  <div role="button" id="d1">Fake button</div>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-kb") as HTMLButtonElement).click());
    await sleep(200);

    const initial = await ctx.sidepanel.evaluate(() => ({
      panelVisible: !document.getElementById("panel-kb")?.hasAttribute("hidden"),
      hasAnalyze: !!document.getElementById("kb-analyze"),
    }));
    if (!initial.panelVisible) ctx.fail({ step: "switch to KB tab", expected: "panel-kb visible", actual: "hidden" });
    if (!initial.hasAnalyze) ctx.fail({ step: "initial KB", expected: "#kb-analyze present", actual: "missing" });

    await ctx.sidepanel.evaluate(() => (document.getElementById("kb-analyze") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector(".kb-row", { timeout: 30000 }); }
    catch { ctx.fail({ step: "kb-analyze", expected: ".kb-row rendered", actual: "timeout" }); throw new Error("analyze-timeout"); }

    const analyzed = await ctx.sidepanel.evaluate(() => ({
      rows: document.querySelectorAll(".kb-row").length,
      gaps: document.querySelectorAll(".kb-gap").length,
      hasMoviePlayAll: !!document.getElementById("movie-play-all"),
      hasToggleTabOrder: !!document.getElementById("toggle-tab-order"),
      hasToggleFocusGaps: !!document.getElementById("toggle-focus-gaps"),
      hasClear: !!document.getElementById("kb-clear"),
    }));
    if (analyzed.rows === 0) ctx.fail({ step: "post-analyze", expected: "≥1 .kb-row", actual: "0" });
    if (!analyzed.hasMoviePlayAll) ctx.fail({ step: "post-analyze", expected: "#movie-play-all visible", actual: "missing" });
    if (!analyzed.hasToggleTabOrder) ctx.fail({ step: "post-analyze", expected: "#toggle-tab-order visible", actual: "missing" });
    if (!analyzed.hasToggleFocusGaps) ctx.fail({ step: "post-analyze", expected: "#toggle-focus-gaps visible", actual: "missing" });
    // The fixture has a div[role=button] with no tabindex — should be flagged as a gap
    if (analyzed.gaps === 0) ctx.fail({ step: "post-analyze", expected: "≥1 .kb-gap (div[role=button] without tabindex)", actual: "0" });

    // Click Clear
    await ctx.sidepanel.evaluate(() => (document.getElementById("kb-clear") as HTMLButtonElement).click());
    await sleep(200);
    const cleared = await ctx.sidepanel.evaluate(() => ({
      rows: document.querySelectorAll(".kb-row").length,
      hasAnalyze: !!document.getElementById("kb-analyze"),
    }));
    if (cleared.rows > 0) ctx.fail({ step: "post-clear", expected: "0 rows", actual: String(cleared.rows) });
    if (!cleared.hasAnalyze) ctx.fail({ step: "post-clear", expected: "#kb-analyze visible (un-analyzed state)", actual: "missing" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "kb-tab");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
