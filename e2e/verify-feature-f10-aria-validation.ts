/**
 * Verify: F10 ARIA validation.
 * Inventory: docs/test-matrix/features/f10-aria-validation.md
 *
 * Two-phase verification matching the inventory's two reference scripts:
 *  - Phase A: page WITH widgets — post-scan ARIA tab shows widget rows +
 *    aria-highlight buttons + role badges
 *  - Phase B: page WITHOUT widgets — post-scan zero-state shows
 *    "No ARIA widgets detected" (NOT the pre-scan "scanned yet" copy)
 *
 * Phase B sentinel-fails on main until PR #102 / #101 lands. The interaction
 * script verify-interaction-aria-tab.ts already documents the same regression.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const NO_ARIA_HTML = `<!doctype html><html><body>
  <h1>No ARIA</h1>
  <p>Plain content, no widget patterns.</p>
</body></html>`;

const WITH_ARIA_HTML = `<!doctype html><html><body>
  <div role="tablist" aria-label="Settings">
    <button role="tab" aria-selected="true" aria-controls="p1">A</button>
    <button role="tab" aria-controls="p2">B</button>
  </div>
  <div role="dialog" aria-label="Confirm">
    <button>OK</button>
  </div>
</body></html>`;

async function run(): Promise<void> {
  // ── Phase A: WITH widgets ──
  {
    const { ctx, cleanup } = await setup(WITH_ARIA_HTML);
    try {
      await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
      try { await ctx.sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 }); }
      catch { ctx.fail({ step: "phase A scan", expected: "results", actual: "timeout" }); throw new Error("scan-timeout"); }
      await sleep(2000);
      await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="aria"]') as HTMLButtonElement).click());
      await sleep(300);

      const a = await ctx.sidepanel.evaluate(() => ({
        hasManual: !!document.getElementById("run-aria-scan"),
        details: document.querySelectorAll("#scan-content details").length,
        ariaHighlight: document.querySelectorAll(".aria-highlight").length,
      }));
      if (a.hasManual) ctx.fail({ step: "phase A widgets present", expected: "no manual scan button when widgets present", actual: "still rendered" });
      if (a.details < 2) ctx.fail({ step: "phase A widget rows", expected: "≥2 widget rows (tablist + dialog)", actual: String(a.details) });
      if (a.ariaHighlight === 0) ctx.fail({ step: "phase A highlight buttons", expected: "≥1 .aria-highlight", actual: "0" });

      if (ctx.failures.length > 0) { await cleanup(); reportAndExit(ctx, "f10-aria-validation (phase A)"); return; }
    } finally { await cleanup(); }
  }

  // ── Phase B: NO widgets ──
  {
    const { ctx, cleanup } = await setup(NO_ARIA_HTML);
    try {
      await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
      try { await ctx.sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 }); }
      catch { ctx.fail({ step: "phase B scan", expected: "results", actual: "timeout" }); throw new Error("scan-timeout"); }
      await sleep(2500);
      await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="aria"]') as HTMLButtonElement).click());
      await sleep(300);

      const b = await ctx.sidepanel.evaluate(() => {
        const html = document.querySelector("#scan-content")?.innerHTML || "";
        return {
          hasManual: !!document.getElementById("run-aria-scan"),
          hasNotScannedYet: html.includes("scanned yet"),
          hasNoneDetected: /No ARIA widgets detected/i.test(html),
        };
      });
      if (b.hasManual) ctx.fail({ step: "phase B post-scan zero state", expected: "no manual button after auto-scan", actual: "still present (PR #102 regression — auto-scan not flipping ariaScanned)" });
      if (b.hasNotScannedYet) ctx.fail({ step: "phase B post-scan zero state", expected: "no 'scanned yet' phrasing post-scan", actual: "phrase still present" });
      if (!b.hasNoneDetected) ctx.fail({ step: "phase B post-scan zero state", expected: "'No ARIA widgets detected'", actual: "missing" });

      reportAndExit(ctx, "f10-aria-validation");
    } finally { await cleanup(); }
  }
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
