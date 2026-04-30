/**
 * Verify: F04 observer mode.
 * Inventory: docs/test-matrix/features/f04-observer-mode.md
 *
 * Per memory file `project_observer_broken`, Observer Mode is permanently
 * disabled in the side panel UI (the .mode-observe button has no data-mode
 * attribute and is non-interactive). This script verifies the disabled-by-
 * default contract holds — i.e. clicking the Observe mode tile DOES NOT toggle
 * Observer state. Until the underlying issue is fixed and the button is
 * re-enabled, this is the correct safety contract.
 *
 * When Observer is re-enabled, this script should be expanded to cover:
 *  - Observer mode toggle persists across sidepanel reload
 *  - tabs.onUpdated auto-scan logs entries with source: "auto"
 *  - Manual scans logged with source: "manual" while observer is on
 *  - observer-domain-filter narrows visible rows
 *  - export-observer / clear-observer
 *  - Observer auto-scans suppressed during active crawl
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F04 fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    const before = await ctx.sidepanel.evaluate(() => {
      const btn = document.querySelector(".mode-btn.mode-observe") as HTMLButtonElement | null;
      return {
        exists: !!btn,
        disabled: btn?.disabled ?? null,
        ariaDisabled: btn?.getAttribute("aria-disabled") ?? null,
        hasDataMode: btn?.hasAttribute("data-mode") ?? false,
        ariaPressed: btn?.getAttribute("aria-pressed") ?? null,
      };
    });
    if (!before.exists) ctx.fail({ step: "observer button", expected: "Observe mode-btn rendered", actual: "missing" });
    // Click the Observe button (whatever its disabled state) — verify aria-pressed
    // does NOT flip on. If the button is properly inert, click does nothing.
    await ctx.sidepanel.evaluate(() => (document.querySelector(".mode-btn.mode-observe") as HTMLButtonElement | null)?.click());
    await sleep(150);
    const after = await ctx.sidepanel.evaluate(() => {
      const btn = document.querySelector(".mode-btn.mode-observe") as HTMLButtonElement | null;
      return { ariaPressed: btn?.getAttribute("aria-pressed") ?? null };
    });

    // Per the memory contract, the Observe button is currently broken / disabled.
    // The safety expectation: aria-pressed must not become "true" — Observer
    // shouldn't accidentally activate. (When fixed and re-enabled, this contract
    // changes and so will the test.)
    if (after.ariaPressed === "true") {
      ctx.fail({
        step: "observer disabled contract",
        expected: "Observe mode-btn click is inert (aria-pressed stays false / null) per project_observer_broken memory",
        actual: "aria-pressed=true (observer activated — memory is stale OR re-enable is in progress; rewrite this test to cover the full F04 AC list)",
      });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f04-observer-mode (limited — observer disabled per project_observer_broken memory)");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
