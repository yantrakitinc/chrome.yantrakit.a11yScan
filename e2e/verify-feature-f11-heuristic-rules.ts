/**
 * Verify: F11 heuristic rules.
 * Inventory: docs/test-matrix/features/f11-heuristic-rules.md
 *
 * Asserts that custom heuristic rules fire alongside axe rules:
 *  - After scanning a fixture engineered to trip multiple heuristics, the
 *    violations list contains ≥1 entry whose id starts with "heuristic-"
 *  - Per-rule fires are content-script-side (Gap 1 limits direct unit
 *    testing); we trust the merged-output signal here.
 *
 * Per-rule unit testing (33 rules) lives in src/content/__tests__/heuristic-rules.test.ts.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

// Trigger rules: decorative symbols (★), generic link text ("click here"),
// small touch target (12×12 button), icon-font (<i class="fa-icon">).
const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>F11 fixture</h1>
  <p>★ ★ ★ ★ ★ ★ ★ ★ ★ ★</p>
  <a href="#">click here</a>
  <button style="width:12px;height:12px">x</button>
  <i class="fa-icon" aria-hidden="true">icon</i>
  <img src="/x.jpg">
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector("#scan-content details", { timeout: 30000 });
    } catch {
      ctx.fail({ step: "scan", expected: "results", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    const out = await ctx.sidepanel.evaluate(() => {
      const detailsEls = document.querySelectorAll("#scan-content details");
      // The raw rule id is preserved in the .explain-btn[data-rule] attribute.
      // Heuristic rules use "heuristic-N" ids (see content/heuristic-rules.ts).
      const explainBtns = Array.from(document.querySelectorAll(".explain-btn"));
      const ruleIds = explainBtns.map((b) => b.getAttribute("data-rule") ?? "");
      const heuristicIds = ruleIds.filter((id) => id.startsWith("heuristic-"));
      return {
        detailsCount: detailsEls.length,
        ruleIds,
        heuristicIdCount: heuristicIds.length,
        heuristicIdsSample: heuristicIds.slice(0, 5),
      };
    });

    if (out.detailsCount === 0) ctx.fail({ step: "scan output", expected: "≥1 violation", actual: "0" });
    if (out.heuristicIdCount === 0) {
      ctx.fail({
        step: "heuristic rules merged",
        expected: "≥1 violation with id starting with 'heuristic-' (read from .explain-btn[data-rule])",
        actual: `none found across ${out.ruleIds.length} rule ids: ${out.ruleIds.slice(0, 8).join(", ")}`,
      });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f11-heuristic-rules");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
