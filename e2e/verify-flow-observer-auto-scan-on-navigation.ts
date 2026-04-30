/**
 * Verify flow: Observer mode auto-scans on navigation.
 * Inventory: docs/test-matrix/flows/observer-auto-scan-on-navigation.md
 *
 * Per the project_observer_broken memory, Observer Mode is permanently
 * disabled in the side panel UI and clicking the Observe tile does not
 * activate Observer state. This script verifies the disabled-by-default
 * safety contract holds; the full auto-scan-on-navigation flow becomes
 * testable when Observer is fixed and re-enabled.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Observer fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    const before = await ctx.sidepanel.evaluate(() => {
      const btn = document.querySelector(".mode-btn.mode-observe") as HTMLButtonElement | null;
      return { ariaPressed: btn?.getAttribute("aria-pressed") ?? null };
    });
    await ctx.sidepanel.evaluate(() => (document.querySelector(".mode-btn.mode-observe") as HTMLButtonElement | null)?.click());
    await sleep(150);
    const after = await ctx.sidepanel.evaluate(() => {
      const btn = document.querySelector(".mode-btn.mode-observe") as HTMLButtonElement | null;
      return { ariaPressed: btn?.getAttribute("aria-pressed") ?? null };
    });

    if (after.ariaPressed === "true") {
      ctx.fail({
        step: "observer disabled contract",
        expected: "click on Observe mode-btn is inert (aria-pressed stays false)",
        actual: "aria-pressed=true — Observer activated; rewrite this flow script to cover the full auto-scan-on-navigation AC list",
      });
    }
    if (before.ariaPressed === "true") {
      ctx.fail({
        step: "observer baseline",
        expected: "Observe mode-btn aria-pressed=false at sidepanel open",
        actual: "true — Observer was already on at init",
      });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-observer-auto-scan-on-navigation (limited — observer disabled per project_observer_broken memory)");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
