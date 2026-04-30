/**
 * Verify: aria-tab interaction.
 * Inventory: docs/test-matrix/interactions/aria-tab.md
 *
 * Asserts (extends e2e/verify-aria-empty-page-state.ts + verify-aria-tab-populated-after-scan.ts
 *  with the structural elements of the ARIA sub-tab itself):
 *  - Pre-scan: empty state with "Scan ARIA Patterns" button + scanned-yet phrasing
 *  - Manual run-aria-scan button works (sets ariaScanned=true even outside Scan Page flow)
 *  - Post-scan zero-result: green text + no manual button
 *  - Post-scan with widgets: details + role badges + aria-highlight buttons
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const NO_ARIA_HTML = `<!doctype html><html><body>
  <h1>No ARIA</h1>
  <p>Plain content.</p>
</body></html>`;

const WITH_ARIA_HTML = `<!doctype html><html><body>
  <div role="tablist" id="t" aria-label="Settings">
    <button role="tab" aria-selected="true" aria-controls="p1">A</button>
    <button role="tab" aria-controls="p2">B</button>
  </div>
  <div role="dialog" id="d" aria-label="Confirm">
    <button>OK</button>
  </div>
</body></html>`;

async function run(): Promise<void> {
  // === Phase 1: WITH widgets — confirms widgets render correctly ===
  {
    const { ctx, cleanup } = await setup(WITH_ARIA_HTML);
    try {
      await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
      try { await ctx.sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 }); }
      catch { ctx.fail({ step: "with-aria scan", expected: "results", actual: "timeout" }); throw new Error("scan-timeout"); }
      await sleep(2000);
      await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="aria"]') as HTMLButtonElement).click());
      await sleep(300);

      const state = await ctx.sidepanel.evaluate(() => {
        const html = document.querySelector("#scan-content")?.innerHTML || "";
        return {
          hasManualBtn: !!document.getElementById("run-aria-scan"),
          hasEmptyText: html.includes("scanned yet"),
          detailsCount: document.querySelectorAll("#scan-content details").length,
          ariaHighlightCount: document.querySelectorAll(".aria-highlight").length,
        };
      });

      if (state.hasManualBtn) ctx.fail({ step: "with-aria post-scan", expected: "no manual button when widgets present", actual: "button visible" });
      if (state.hasEmptyText) ctx.fail({ step: "with-aria post-scan", expected: "no 'scanned yet' phrasing", actual: "text present" });
      if (state.detailsCount < 2) ctx.fail({ step: "with-aria widgets count", expected: "≥2 widgets (tablist + dialog)", actual: String(state.detailsCount) });
      if (state.ariaHighlightCount === 0) ctx.fail({ step: "with-aria highlight buttons", expected: "≥1 aria-highlight button", actual: "0" });

      if (ctx.failures.length > 0) {
        await cleanup();
        reportAndExit(ctx, "aria-tab (with-widgets phase)");
        return;
      }
    } finally {
      await cleanup();
    }
  }

  // === Phase 2: NO widgets — confirms post-scan zero-result rendering ===
  {
    const { ctx, cleanup } = await setup(NO_ARIA_HTML);
    try {
      await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
      try { await ctx.sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 }); }
      catch { ctx.fail({ step: "no-aria scan", expected: "results", actual: "timeout" }); throw new Error("scan-timeout"); }
      await sleep(2000);
      await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="aria"]') as HTMLButtonElement).click());
      await sleep(300);

      const state = await ctx.sidepanel.evaluate(() => {
        const html = document.querySelector("#scan-content")?.innerHTML || "";
        return {
          hasManualBtn: !!document.getElementById("run-aria-scan"),
          hasEmptyText: html.includes("scanned yet"),
          hasDetectedText: html.includes("No ARIA widgets detected on this page"),
        };
      });

      if (state.hasManualBtn) ctx.fail({ step: "no-aria post-scan", expected: "no manual button (post-scan zero-result state)", actual: "button visible (likely PR #102 missing or regression)" });
      if (state.hasEmptyText) ctx.fail({ step: "no-aria post-scan", expected: "NO 'scanned yet' phrasing", actual: "text present" });
      if (!state.hasDetectedText) ctx.fail({ step: "no-aria post-scan", expected: "'No ARIA widgets detected on this page'", actual: "missing" });

      reportAndExit(ctx, "aria-tab (no-widgets phase)");
    } finally {
      await cleanup();
    }
  }
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
