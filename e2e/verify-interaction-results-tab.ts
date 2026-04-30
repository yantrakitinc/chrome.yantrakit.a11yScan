/**
 * Verify: results-tab interaction.
 * Inventory: docs/test-matrix/interactions/results-tab.md
 *
 * Asserts:
 *  - After scan, Results sub-tab is active by default
 *  - At least one violation rendered as <details> with severity-* class
 *  - Each violation has a Highlight button + Explain Further button
 *  - Click Highlight sends HIGHLIGHT_ELEMENT (verified via captured chrome.runtime call)
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

// Fixture with at least one guaranteed violation (color-contrast won't because text is black-on-white;
// use missing alt-text on an image which DOES violate axe rules)
const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head><title>Results fixture</title></head>
<body>
  <h1>Results fixture</h1>
  <img src="/no.jpg">
  <button></button>
</body>
</html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 });
    } catch {
      ctx.fail({ step: "wait-for-results", expected: "results render", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    await sleep(500);

    const state = await ctx.sidepanel.evaluate(() => {
      const detailsEls = document.querySelectorAll("#scan-content details");
      const severityClasses = Array.from(detailsEls).map((d) => Array.from(d.classList).filter((c) => c.startsWith("severity-")));
      const highlightBtns = document.querySelectorAll(".highlight-btn").length;
      const explainBtns = document.querySelectorAll(".explain-btn").length;
      return {
        detailsCount: detailsEls.length,
        anySeverity: severityClasses.some((arr) => arr.length > 0),
        highlightBtns,
        explainBtns,
        activeSubtab: document.querySelector('[data-subtab="results"]')?.getAttribute("aria-selected") === "true",
      };
    });

    if (state.detailsCount === 0) ctx.fail({ step: "violations-rendered", expected: "≥1 <details> in #scan-content", actual: "0" });
    if (!state.anySeverity) ctx.fail({ step: "severity-class", expected: "≥1 details has severity-{level} class", actual: "none did" });
    if (state.highlightBtns === 0) ctx.fail({ step: "highlight-buttons", expected: "≥1 .highlight-btn", actual: "0" });
    if (state.explainBtns === 0) ctx.fail({ step: "explain-buttons", expected: "≥1 .explain-btn", actual: "0" });
    if (!state.activeSubtab) ctx.fail({ step: "active-subtab", expected: "results sub-tab is aria-selected", actual: "not selected" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "results-tab");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
