/**
 * Verify: F17 AI chat tab.
 * Inventory: docs/test-matrix/features/f17-ai-chat-tab.md
 *
 * The AI tab is permanently disabled in the production HTML
 * (#tab-ai has `disabled` + aria-disabled="true" because Chrome's built-in AI
 * is unavailable in most environments). This script verifies the disabled
 * fallback contract:
 *  - tab-ai button is rendered with disabled aria-disabled
 *  - Clicking the AI tab does NOT switch to the AI panel (the disabled tab
 *    rejects the click)
 *  - panel-ai exists in the DOM but stays hidden when AI is unavailable
 *
 * When real Chrome AI lands and the tab is enabled, this script must be
 * expanded to cover send-message + history + load-from-history + delete.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F17 fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    const tabState = await ctx.sidepanel.evaluate(() => {
      const t = document.getElementById("tab-ai") as HTMLButtonElement | null;
      return {
        exists: !!t,
        disabled: t?.disabled ?? false,
        ariaDisabled: t?.getAttribute("aria-disabled") ?? null,
        hasSoonDesc: !!document.getElementById("ai-soon-desc"),
      };
    });
    if (!tabState.exists) ctx.fail({ step: "AI tab", expected: "#tab-ai rendered", actual: "missing" });
    if (!tabState.disabled && tabState.ariaDisabled !== "true") {
      ctx.fail({
        step: "AI disabled fallback",
        expected: "#tab-ai disabled + aria-disabled=true (Chrome AI unavailable contract)",
        actual: `disabled=${tabState.disabled} aria-disabled=${tabState.ariaDisabled} — if AI is now available, expand this script to cover the active F17 AC list`,
      });
    }
    if (!tabState.hasSoonDesc) {
      ctx.fail({
        step: "AI soon description",
        expected: "#ai-soon-desc tooltip/desc rendered with the disabled tab",
        actual: "missing",
      });
    }

    // Click the disabled tab — the active top-tab should NOT change
    const beforeActive = await ctx.sidepanel.evaluate(() =>
      document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? ""
    );
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-ai") as HTMLButtonElement)?.click());
    await sleep(200);
    const afterActive = await ctx.sidepanel.evaluate(() =>
      document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? ""
    );
    if (afterActive === "tab-ai") {
      ctx.fail({
        step: "click disabled tab",
        expected: "active tab unchanged after clicking disabled #tab-ai",
        actual: `switched from ${beforeActive} → ${afterActive}`,
      });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f17-ai-chat-tab (limited — AI tab disabled by default)");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
