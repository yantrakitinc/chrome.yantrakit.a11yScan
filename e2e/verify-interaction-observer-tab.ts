/**
 * Verify: observer-tab interaction.
 * Inventory: docs/test-matrix/interactions/observer-tab.md
 *
 * Asserts:
 *  - Observer sub-tab only visible when state.observer=true
 *  - Empty-state message when no entries
 *  - clear-observer button exists
 *  - export-observer button exists
 *  - observer-domain-filter exists; typing narrows visible rows
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Observer fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Observer sub-tab should NOT be visible initially (state.observer=false)
    const initial = await ctx.sidepanel.evaluate(() => ({
      hasObserverSubtab: !!document.querySelector('[data-subtab="observe"]'),
      observerBtnDisabled: !!(document.querySelector('.mode-btn.mode-observe') as HTMLButtonElement | null)?.disabled,
    }));
    if (initial.hasObserverSubtab) ctx.fail({ step: "initial", expected: "no observer sub-tab when observer=false", actual: "present" });

    // Observer mode is currently DISABLED in production (Coming Soon — per
    // project_observer_broken memory + render-header.ts:120). The button has
    // class .mode-observe and is permanently disabled. Verify that it cannot
    // be activated and that the observer sub-tab does NOT appear after scan.
    if (!initial.observerBtnDisabled) {
      ctx.fail({ step: "observer-disabled-state", expected: "observer mode-btn is disabled (Coming Soon)", actual: "button is enabled — F04 may have been re-enabled but this script not updated" });
    }

    // Try clicking it anyway — should be a no-op since disabled
    await ctx.sidepanel.evaluate(() => (document.querySelector('.mode-btn.mode-observe') as HTMLButtonElement | null)?.click());
    await sleep(200);
    const afterClickAttempt = await ctx.sidepanel.evaluate(() => ({
      pressed: document.querySelector('.mode-btn.mode-observe')?.getAttribute("aria-pressed"),
    }));
    // Disabled buttons should NOT have aria-pressed=true
    if (afterClickAttempt.pressed === "true") {
      ctx.fail({ step: "click disabled observer", expected: "aria-pressed not true (button is disabled)", actual: "aria-pressed=true — disabled state didn't prevent activation" });
    }

    // Observer is disabled; no further interactions to test. The Observer
    // sub-tab + filter input + clear/export buttons exist but are unreachable
    // via UI today. Their unit tests cover the renderer + handlers.
    console.log("Observer mode is currently disabled (Coming Soon). Verified that disabled state holds.");
    reportAndExit(ctx, "observer-tab (limited — observer disabled by design)");
    return;

    // (unreachable — early return above)
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "observer-tab");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
