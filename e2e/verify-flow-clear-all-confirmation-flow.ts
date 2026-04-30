/**
 * Verify flow: Clear button (action area) + confirm-clear-bar (yes/cancel)
 * paths.
 * Inventory: docs/test-matrix/flows/clear-all-confirmation-flow.md
 *
 * The right-click context menu UI is Chrome-internal and not driveable via
 * Puppeteer (Gap). The bar is shown by setting its `hidden` attribute via
 * the CONFIRM_CLEAR_ALL handler — for the verify, we exercise the yes/cancel
 * paths by directly unhiding the bar (the handler that the context-menu would
 * have called).
 *
 * Covers:
 *  - Static scaffold (#confirm-clear-bar / #confirm-clear-yes / #confirm-clear-cancel)
 *  - Cancel path: bar hides, no state change, scan results preserved
 *  - Yes path: bar hides, CLEAR_ALL_CONFIRMED dispatched, scan state wiped
 *  - Re-show after cancel: cancel doesn't lock the bar; subsequent shows work
 *  - Direct Clear button click (no confirmation): wipes scan state
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>Clear-flow fixture</h1>
  <img src="/x.jpg">
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // 1. Static scaffold present
    const scaffold = await ctx.sidepanel.evaluate(() => ({
      hasBar: !!document.getElementById("confirm-clear-bar"),
      hasYes: !!document.getElementById("confirm-clear-yes"),
      hasCancel: !!document.getElementById("confirm-clear-cancel"),
      barHidden: (document.getElementById("confirm-clear-bar") as HTMLElement | null)?.hidden ?? null,
    }));
    if (!scaffold.hasBar) ctx.fail({ step: "scaffold", expected: "#confirm-clear-bar", actual: "missing" });
    if (!scaffold.hasYes) ctx.fail({ step: "scaffold", expected: "#confirm-clear-yes", actual: "missing" });
    if (!scaffold.hasCancel) ctx.fail({ step: "scaffold", expected: "#confirm-clear-cancel", actual: "missing" });
    if (scaffold.barHidden !== true) ctx.fail({ step: "scaffold", expected: "bar hidden by default", actual: String(scaffold.barHidden) });

    // 2. Run a scan so we have state to test the yes path against.
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector("#clear-btn", { timeout: 30000 }); }
    catch { ctx.fail({ step: "scan", expected: "#clear-btn after results", actual: "timeout" }); throw new Error("scan-timeout"); }

    const beforeAny = await ctx.sidepanel.evaluate(() => ({
      hasResults: !!document.querySelector("#scan-content details"),
    }));
    if (!beforeAny.hasResults) ctx.fail({ step: "pre-confirmation", expected: "results details before clearing", actual: "none" });

    // 3. CANCEL PATH — show the bar (mimicking what CONFIRM_CLEAR_ALL handler
    //    does), click Cancel, verify bar hides + scan results preserved.
    await ctx.sidepanel.evaluate(() => {
      (document.getElementById("confirm-clear-bar") as HTMLElement).hidden = false;
    });
    await sleep(150);
    let mid = await ctx.sidepanel.evaluate(() => ({
      barHidden: (document.getElementById("confirm-clear-bar") as HTMLElement | null)?.hidden ?? null,
    }));
    if (mid.barHidden !== false) ctx.fail({ step: "show bar (cancel path)", expected: "bar visible", actual: String(mid.barHidden) });

    await ctx.sidepanel.evaluate(() => (document.getElementById("confirm-clear-cancel") as HTMLButtonElement).click());
    await sleep(200);
    const afterCancel = await ctx.sidepanel.evaluate(() => ({
      barHidden: (document.getElementById("confirm-clear-bar") as HTMLElement | null)?.hidden ?? null,
      hasResults: !!document.querySelector("#scan-content details"),
    }));
    if (afterCancel.barHidden !== true) ctx.fail({ step: "click cancel", expected: "bar hidden after cancel", actual: String(afterCancel.barHidden) });
    if (!afterCancel.hasResults) ctx.fail({ step: "click cancel", expected: "scan results preserved (cancel does not clear)", actual: "wiped" });

    // 4. RE-SHOW AFTER CANCEL — bar can be reopened
    await ctx.sidepanel.evaluate(() => {
      (document.getElementById("confirm-clear-bar") as HTMLElement).hidden = false;
    });
    await sleep(150);
    mid = await ctx.sidepanel.evaluate(() => ({
      barHidden: (document.getElementById("confirm-clear-bar") as HTMLElement | null)?.hidden ?? null,
    }));
    if (mid.barHidden !== false) ctx.fail({ step: "re-show after cancel", expected: "bar visible on second show", actual: String(mid.barHidden) });

    // 5. YES PATH — click Yes, verify bar hides + scan state wiped (via
    //    CLEAR_ALL_CONFIRMED dispatch which the background routes to STATE_CLEARED).
    //    The route is fire-and-forget; we observe the eventual UI state.
    await ctx.sidepanel.evaluate(() => (document.getElementById("confirm-clear-yes") as HTMLButtonElement).click());
    await sleep(700);
    const afterYes = await ctx.sidepanel.evaluate(() => ({
      barHidden: (document.getElementById("confirm-clear-bar") as HTMLElement | null)?.hidden ?? null,
      hasResults: !!document.querySelector("#scan-content details"),
      hasClearBtn: !!document.getElementById("clear-btn"),
    }));
    if (afterYes.barHidden !== true) ctx.fail({ step: "click yes", expected: "bar hidden after yes", actual: String(afterYes.barHidden) });
    if (afterYes.hasResults) ctx.fail({ step: "click yes", expected: "scan results wiped via STATE_CLEARED", actual: "still rendered" });
    if (afterYes.hasClearBtn) ctx.fail({ step: "click yes", expected: "#clear-btn hidden after wipe", actual: "still rendered" });

    // 6. ESCAPE PATH — pressing Escape while bar is visible closes it
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    await ctx.sidepanel.waitForSelector("#clear-btn", { timeout: 30000 });
    await ctx.sidepanel.evaluate(() => {
      (document.getElementById("confirm-clear-bar") as HTMLElement).hidden = false;
    });
    await sleep(150);
    await ctx.sidepanel.keyboard.press("Escape");
    await sleep(200);
    const afterEsc = await ctx.sidepanel.evaluate(() => ({
      barHidden: (document.getElementById("confirm-clear-bar") as HTMLElement | null)?.hidden ?? null,
      hasResults: !!document.querySelector("#scan-content details"),
    }));
    if (afterEsc.barHidden !== true) ctx.fail({ step: "escape closes bar", expected: "bar hidden after Escape", actual: String(afterEsc.barHidden) });
    if (!afterEsc.hasResults) ctx.fail({ step: "escape preserves results", expected: "scan results preserved (Escape doesn't clear)", actual: "wiped" });

    // 7. DIRECT CLEAR BUTTON — bypasses the bar entirely
    await ctx.sidepanel.evaluate(() => (document.getElementById("clear-btn") as HTMLButtonElement).click());
    await sleep(500);
    const afterClear = await ctx.sidepanel.evaluate(() => ({
      hasResults: !!document.querySelector("#scan-content details"),
      hasClearBtn: !!document.getElementById("clear-btn"),
    }));
    if (afterClear.hasResults) ctx.fail({ step: "direct clear", expected: "results wiped", actual: "still rendered" });
    if (afterClear.hasClearBtn) ctx.fail({ step: "direct clear", expected: "#clear-btn hidden", actual: "still rendered" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-clear-all-confirmation");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
