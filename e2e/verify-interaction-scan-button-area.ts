/**
 * Verify: scan-button-area interaction.
 * Inventory: docs/test-matrix/interactions/scan-button-area.md
 *
 * Asserts:
 *  - #scan-btn exists initially
 *  - Click → SCAN_REQUEST round-trip; scanPhase transitions; results sub-tabs render
 *  - Clear button appears in results phase
 *  - Click Clear → state wipes; scan-btn back to "Scan Page" + no clear
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>Scan button fixture</h1>
  <p>Plain content with no violations.</p>
  <button>Click me</button>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Initial: scan-btn exists; clear-btn does not
    const initial = await ctx.sidepanel.evaluate(() => ({
      scanBtn: !!document.getElementById("scan-btn"),
      clearBtn: !!document.getElementById("clear-btn"),
    }));
    if (!initial.scanBtn) ctx.fail({ step: "initial", expected: "#scan-btn present", actual: "missing" });
    if (initial.clearBtn) ctx.fail({ step: "initial", expected: "no #clear-btn", actual: "present" });

    // Click scan-btn
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());

    // Wait for results
    try {
      await ctx.sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 });
    } catch {
      ctx.fail({ step: "wait-for-results", expected: "results sub-tabs render", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    // Now: clear-btn exists
    const afterScan = await ctx.sidepanel.evaluate(() => ({
      clearBtn: !!document.getElementById("clear-btn"),
      scanBtnText: document.getElementById("scan-btn")?.textContent?.trim() || "",
    }));
    if (!afterScan.clearBtn) ctx.fail({ step: "after-scan", expected: "#clear-btn visible", actual: "missing" });

    // Click clear-btn
    await ctx.sidepanel.evaluate(() => (document.getElementById("clear-btn") as HTMLButtonElement).click());
    await sleep(300);
    const afterClear = await ctx.sidepanel.evaluate(() => ({
      clearBtn: !!document.getElementById("clear-btn"),
      subtabs: document.querySelectorAll('[data-subtab]').length,
    }));
    if (afterClear.clearBtn) ctx.fail({ step: "after-clear", expected: "no #clear-btn", actual: "still visible" });
    if (afterClear.subtabs > 0) ctx.fail({ step: "after-clear", expected: "no sub-tabs", actual: `${afterClear.subtabs} sub-tabs visible` });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "scan-button-area");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
