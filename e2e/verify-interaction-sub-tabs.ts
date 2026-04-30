/**
 * Verify: sub-tabs interaction.
 * Inventory: docs/test-matrix/interactions/sub-tabs.md
 *
 * Requires scan results to be visible. Drives a scan first, then exercises sub-tab click + arrow nav.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>Sub-tabs fixture</h1>
  <button>x</button>
</body></html>`;

const SUB_TABS = ["results", "manual", "aria"] as const;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Scan first
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 });
    } catch {
      ctx.fail({ step: "scan-results", expected: "sub-tabs render", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    // Click each sub-tab
    for (const t of SUB_TABS) {
      await ctx.sidepanel.evaluate((tab) => (document.querySelector(`[data-subtab="${tab}"]`) as HTMLButtonElement | null)?.click(), t);
      await sleep(150);
      const state = await ctx.sidepanel.evaluate((tab) => ({
        ariaSelected: document.querySelector(`[data-subtab="${tab}"]`)?.getAttribute("aria-selected") === "true",
        active: document.querySelector(`[data-subtab="${tab}"]`)?.classList.contains("active") ?? false,
      }), t);
      if (!state.ariaSelected) ctx.fail({ step: `click ${t}`, expected: "aria-selected=true", actual: "false" });
      if (!state.active) ctx.fail({ step: `click ${t}`, expected: ".active class", actual: "missing" });
    }

    // Arrow Right from results → manual
    await ctx.sidepanel.evaluate(() => {
      const r = document.querySelector('[data-subtab="results"]') as HTMLButtonElement;
      r?.click();
      r?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    });
    await sleep(150);
    const arrowRight = await ctx.sidepanel.evaluate(() => ({
      manual: document.querySelector('[data-subtab="manual"]')?.getAttribute("aria-selected") === "true",
    }));
    if (!arrowRight.manual) ctx.fail({ step: "ArrowRight from results", expected: "manual aria-selected=true", actual: "not selected" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "sub-tabs");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
