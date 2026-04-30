/**
 * Verify: F01 single-page scan.
 * Inventory: docs/test-matrix/features/f01-single-page-scan.md
 *
 * AC verified:
 *  - Scan-btn click → SCAN_REQUEST → SCAN_RESULT round-trip succeeds
 *  - state.scanPhase: idle → scanning → results (observable via UI: scan-btn,
 *    progress, then export-action-bar/details rendering)
 *  - Accordion auto-collapses when scan starts
 *  - Results sub-tab is the active sub-tab when scan completes
 *  - Violations rendered as <details> with severity-{level} classes
 *  - Each violation has Highlight + Explain Further buttons
 *  - WCAG version + level dropdowns are present (control runOnly tags — verified
 *    structurally; the actual axe-core rule subset is its own test boundary)
 *  - Background ARIA scan kicks off after primary scan (ariaScanned flips so the
 *    ARIA sub-tab no longer shows the manual scan button)
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html>
<html lang="en">
<head><title>F01 fixture</title></head>
<body>
  <h1>F01 fixture</h1>
  <img src="/x.jpg">
  <button></button>
  <a href="#"></a>
</body>
</html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Pre-click: check WCAG dropdowns + accordion expanded by default
    const pre = await ctx.sidepanel.evaluate(() => ({
      hasWcagVersion: !!document.getElementById("wcag-version"),
      hasWcagLevel: !!document.getElementById("wcag-level"),
      accordionExpanded: document.getElementById("accordion-toggle")?.getAttribute("aria-expanded"),
    }));
    if (!pre.hasWcagVersion) ctx.fail({ step: "pre-scan", expected: "#wcag-version dropdown", actual: "missing" });
    if (!pre.hasWcagLevel) ctx.fail({ step: "pre-scan", expected: "#wcag-level dropdown", actual: "missing" });

    // Click Scan Page
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());

    // Briefly: scanPhase=scanning → accordion collapsed (was expanded), progress bar visible
    await sleep(150);
    const scanning = await ctx.sidepanel.evaluate(() => ({
      accordionCollapsed: document.getElementById("accordion-toggle")?.getAttribute("aria-expanded") === "false",
      progressOrCancel: !!document.getElementById("cancel-scan") || !!document.querySelector(".progress-bar"),
    }));
    if (!scanning.accordionCollapsed) ctx.fail({ step: "scanning phase", expected: "accordion auto-collapsed (aria-expanded=false)", actual: "still expanded" });
    if (!scanning.progressOrCancel) ctx.fail({ step: "scanning phase", expected: "#cancel-scan or .progress-bar visible", actual: "missing" });

    // Wait for results
    try {
      await ctx.sidepanel.waitForSelector("#scan-content details", { timeout: 30000 });
    } catch {
      ctx.fail({ step: "results render", expected: "≥1 <details> in #scan-content", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    const results = await ctx.sidepanel.evaluate(() => {
      const detailsEls = Array.from(document.querySelectorAll("#scan-content details"));
      const severityHits = detailsEls.filter((d) =>
        Array.from(d.classList).some((c) => c.startsWith("severity-"))
      ).length;
      return {
        detailsCount: detailsEls.length,
        severityHits,
        highlightBtns: document.querySelectorAll(".highlight-btn").length,
        explainBtns: document.querySelectorAll(".explain-btn").length,
        resultsActive: document.querySelector('[data-subtab="results"]')?.getAttribute("aria-selected") === "true",
      };
    });
    if (results.detailsCount === 0) ctx.fail({ step: "post-scan results", expected: "≥1 violation <details>", actual: "0" });
    if (results.severityHits === 0) ctx.fail({ step: "post-scan results", expected: "≥1 details with severity-{level} class", actual: "none" });
    if (results.highlightBtns === 0) ctx.fail({ step: "post-scan results", expected: "≥1 .highlight-btn", actual: "0" });
    if (results.explainBtns === 0) ctx.fail({ step: "post-scan results", expected: "≥1 .explain-btn", actual: "0" });
    if (!results.resultsActive) ctx.fail({ step: "post-scan results", expected: "results sub-tab aria-selected=true", actual: "not selected" });

    // Background ARIA scan: wait for the aria sub-tab post-scan zero-state to flip from
    // pre-scan ("Scan ARIA Patterns" button) to scanned ("No ARIA widgets detected").
    // The fixture page has no ARIA widgets, so we expect the scanned-zero state.
    await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="aria"]') as HTMLButtonElement).click());
    await sleep(2500);
    const aria = await ctx.sidepanel.evaluate(() => ({
      stillHasManualButton: !!document.getElementById("run-aria-scan"),
      bodyText: document.getElementById("scan-content")?.textContent ?? "",
    }));
    if (aria.stillHasManualButton) {
      ctx.fail({ step: "background ARIA scan", expected: "ariaScanned=true → no #run-aria-scan button after auto-scan", actual: "manual scan button still present (ariaScanned never flipped — bug fixed in PR #102)" });
    }
    if (!/No ARIA widgets/i.test(aria.bodyText)) {
      ctx.fail({ step: "ARIA post-scan zero state", expected: "'No ARIA widgets detected' message", actual: aria.bodyText.slice(0, 200) });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f01-single-page-scan");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
