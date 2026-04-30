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

    // Step 8 — Toggle Pass on row 0 again → state should toggle off (null)
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
      ctx.fail({ step: "toggle Pass off (step 8)", expected: "aria-pressed=false after second click", actual: String(toggled) });
    }

    // Step 9 — Click Pass on row 1 (which is currently Fail) → flips to Pass
    const sel1 = rowSelectors[1];
    await ctx.sidepanel.evaluate((sel) => {
      const row = document.querySelector(`[data-criterion="${sel}"]`);
      (row?.querySelector('.manual-btn[data-status="pass"]') as HTMLButtonElement | null)?.click();
    }, sel1);
    await sleep(150);
    const flipped = await ctx.sidepanel.evaluate((sel) => {
      const row = document.querySelector(`[data-criterion="${sel}"]`);
      const passed = row?.querySelector('.manual-btn[data-status="pass"]')?.getAttribute("aria-pressed");
      const failed = row?.querySelector('.manual-btn[data-status="fail"]')?.getAttribute("aria-pressed");
      return { passed, failed };
    }, sel1);
    if (flipped.passed !== "true") {
      ctx.fail({ step: "flip Fail→Pass (step 9)", expected: "Pass aria-pressed=true on row 1", actual: String(flipped.passed) });
    }
    if (flipped.failed === "true") {
      ctx.fail({ step: "flip Fail→Pass (step 9)", expected: "Fail aria-pressed=false (mutually exclusive)", actual: "still pressed" });
    }

    // Step 7 — Sidepanel reload → state restored from chrome.storage.local
    // (re-navigate the same chrome-extension://.../sidepanel.html URL).
    const sidepanelUrl = ctx.sidepanel.url();
    await ctx.sidepanel.goto(sidepanelUrl, { waitUntil: "domcontentloaded" });
    await sleep(500);
    // Re-trigger a scan on the same URL (state.lastScanResult is wiped on
    // reload; loadManualReviewFor restores from storage).
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    await ctx.sidepanel.waitForSelector('[data-subtab="manual"]', { timeout: 30000 });
    await sleep(500);
    await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="manual"]') as HTMLButtonElement).click());
    await sleep(400);

    // Expected post-reload state, mirroring steps 8-9 we just performed:
    //   row 0 → null (toggled Pass off)
    //   row 1 → "pass" (flipped from Fail to Pass)
    //   row 2 → "na" (unchanged)
    const reloaded = await ctx.sidepanel.evaluate((rs) => {
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

    if (reloaded[rowSelectors[0]] !== null) {
      ctx.fail({ step: "step 7 reload — row 0", expected: "null (toggled off in step 8)", actual: String(reloaded[rowSelectors[0]]) });
    }
    if (reloaded[rowSelectors[1]] !== "pass") {
      ctx.fail({ step: "step 7 reload — row 1", expected: "pass (flipped in step 9)", actual: String(reloaded[rowSelectors[1]]) });
    }
    if (reloaded[rowSelectors[2]] !== "na") {
      ctx.fail({ step: "step 7 reload — row 2", expected: "na (unchanged across reload)", actual: String(reloaded[rowSelectors[2]]) });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-manual-review-persistence");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
