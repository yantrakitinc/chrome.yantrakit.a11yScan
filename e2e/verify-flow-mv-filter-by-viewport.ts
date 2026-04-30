/**
 * Verify flow: Multi-viewport scan → filter results by viewport chip.
 * Inventory: docs/test-matrix/flows/mv-filter-by-viewport.md
 *
 * Lightweight check — drives an MV scan and verifies that:
 *  - mv-filter-chip elements render after results
 *  - Clicking a chip toggles aria-pressed
 *
 * (Per-viewport diff classification + window resize behavior are covered by
 * unit tests in src/background/__tests__/multi-viewport.test.ts.)
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>MV filter fixture</h1>
  <img src="/x.jpg">
  <button></button>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("mv-check") as HTMLInputElement).click());
    await sleep(150);

    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector("#scan-content details", { timeout: 90000 }); }
    catch { ctx.fail({ step: "MV scan", expected: "results render", actual: "timeout" }); throw new Error("scan-timeout"); }

    const initial = await ctx.sidepanel.evaluate(() => {
      const chips = Array.from(document.querySelectorAll(".mv-filter-chip, [data-mvfilter]")) as HTMLElement[];
      return {
        chipCount: chips.length,
        chipDataValues: chips.map((c) => c.getAttribute("data-mvfilter") ?? c.textContent?.trim()).filter(Boolean),
      };
    });
    if (initial.chipCount === 0) {
      ctx.fail({
        step: "MV chips render",
        expected: "≥1 .mv-filter-chip / [data-mvfilter] post-scan",
        actual: "no chips found — MV diff may have produced empty viewportSpecific array (fixture too simple) or class names changed",
      });
      // Non-fatal — continue with smoke check below
    }

    // Click a chip if available
    if (initial.chipCount > 0) {
      await ctx.sidepanel.evaluate(() => {
        const chip = document.querySelector(".mv-filter-chip, [data-mvfilter]") as HTMLButtonElement | null;
        chip?.click();
      });
      await sleep(300);
      const afterClick = await ctx.sidepanel.evaluate(() => {
        const chip = document.querySelector(".mv-filter-chip, [data-mvfilter]") as HTMLButtonElement | null;
        return { aria: chip?.getAttribute("aria-pressed") ?? null };
      });
      if (afterClick.aria !== "true") {
        ctx.fail({ step: "chip click", expected: "aria-pressed=true after first chip click", actual: String(afterClick.aria) });
      }
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-mv-filter-by-viewport");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
