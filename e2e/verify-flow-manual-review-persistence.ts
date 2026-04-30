/**
 * Verify flow: Manual review state persists across re-scan.
 * Inventory: docs/test-matrix/flows/manual-review-persistence.md
 *
 * Asserts:
 *  - After scan, marking 3 criteria via Pass/Fail/N/A persists their state
 *  - Re-scanning the SAME URL restores the prior selections
 *
 * (Sidepanel reload across browser restart is a chrome.storage.local boundary
 * verified by unit tests; this script focuses on the same-session re-scan
 * round-trip.)
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Persistence fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // First scan
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector('[data-subtab="manual"]', { timeout: 30000 }); }
    catch { ctx.fail({ step: "scan #1", expected: "manual sub-tab", actual: "timeout" }); throw new Error("scan-timeout"); }
    await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="manual"]') as HTMLButtonElement).click());
    await sleep(400);

    const rowSelectors = await ctx.sidepanel.evaluate(() => {
      const rows = Array.from(document.querySelectorAll("[data-criterion]"));
      return rows.slice(0, 3).map((r) => r.getAttribute("data-criterion")!);
    });
    if (rowSelectors.length < 3) {
      ctx.fail({ step: "manual rows", expected: "≥3 criteria rows", actual: String(rowSelectors.length) });
      return;
    }

    // Set Pass on row 0, Fail on row 1, N/A on row 2
    const actions: Array<"pass" | "fail" | "na"> = ["pass", "fail", "na"];
    for (let i = 0; i < 3; i++) {
      const sel = rowSelectors[i];
      const action = actions[i];
      await ctx.sidepanel.evaluate(({ sel, action }) => {
        const row = document.querySelector(`[data-criterion="${sel}"]`);
        const btn = row?.querySelector(`.manual-btn[data-status="${action}"]`) as HTMLButtonElement | null;
        btn?.click();
      }, { sel, action });
      await sleep(120);
    }

    // Verify aria-pressed reflects each
    const set = await ctx.sidepanel.evaluate((rs) => {
      const result: Record<string, string | null> = {};
      for (const sel of rs) {
        const row = document.querySelector(`[data-criterion="${sel}"]`);
        const passed = row?.querySelector('.manual-btn[data-status="pass"]')?.getAttribute("aria-pressed");
        const failed = row?.querySelector('.manual-btn[data-status="fail"]')?.getAttribute("aria-pressed");
        const na = row?.querySelector('.manual-btn[data-status="na"]')?.getAttribute("aria-pressed");
        if (passed === "true") result[sel] = "pass";
        else if (failed === "true") result[sel] = "fail";
        else if (na === "true") result[sel] = "na";
        else result[sel] = null;
      }
      return result;
    }, rowSelectors);
    for (let i = 0; i < 3; i++) {
      if (set[rowSelectors[i]] !== actions[i]) {
        ctx.fail({ step: `set ${actions[i]} on ${rowSelectors[i]}`, expected: actions[i], actual: String(set[rowSelectors[i]]) });
      }
    }

    // Re-scan same URL → state should be restored
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    await sleep(8000);
    await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="manual"]') as HTMLButtonElement).click());
    await sleep(400);

    const restored = await ctx.sidepanel.evaluate((rs) => {
      const result: Record<string, string | null> = {};
      for (const sel of rs) {
        const row = document.querySelector(`[data-criterion="${sel}"]`);
        const passed = row?.querySelector('.manual-btn[data-status="pass"]')?.getAttribute("aria-pressed");
        const failed = row?.querySelector('.manual-btn[data-status="fail"]')?.getAttribute("aria-pressed");
        const na = row?.querySelector('.manual-btn[data-status="na"]')?.getAttribute("aria-pressed");
        if (passed === "true") result[sel] = "pass";
        else if (failed === "true") result[sel] = "fail";
        else if (na === "true") result[sel] = "na";
        else result[sel] = null;
      }
      return result;
    }, rowSelectors);

    for (let i = 0; i < 3; i++) {
      if (restored[rowSelectors[i]] !== actions[i]) {
        ctx.fail({ step: `re-scan persistence for ${rowSelectors[i]}`, expected: actions[i] + " restored", actual: String(restored[rowSelectors[i]]) });
      }
    }

    // Toggle Pass on row 0 again → should null
    const sel0 = rowSelectors[0];
    await ctx.sidepanel.evaluate((sel) => {
      const row = document.querySelector(`[data-criterion="${sel}"]`);
      (row?.querySelector('.manual-btn[data-status="pass"]') as HTMLButtonElement | null)?.click();
    }, sel0);
    await sleep(150);
    const toggled = await ctx.sidepanel.evaluate((sel) => {
      const row = document.querySelector(`[data-criterion="${sel}"]`);
      const passed = row?.querySelector('.manual-btn[data-status="pass"]')?.getAttribute("aria-pressed");
      return passed;
    }, sel0);
    if (toggled !== "false") {
      ctx.fail({ step: "toggle Pass off", expected: "aria-pressed=false after second click", actual: String(toggled) });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-manual-review-persistence");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
