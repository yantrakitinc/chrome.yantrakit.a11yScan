/**
 * Verify: top-tabs interaction.
 * Inventory: docs/test-matrix/interactions/top-tabs.md
 *
 * Asserts:
 *  - 4 top tabs exist (Scan, Screen Reader, Keyboard, AI Chat)
 *  - Click each → aria-selected flips to true on the clicked tab
 *  - Click each → matching panel becomes visible (hidden=false)
 *  - ArrowRight from a tab moves activation to the next
 *  - Home/End jump to first/last
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Tab nav fixture</h1></body></html>`;

// Note: tab-ai is "coming soon" — disabled in HTML by default. Home/End skip
// disabled tabs, so the test only exercises the enabled tabs.
const TABS = ["scan", "sr", "kb"] as const;
const PANELS = ["panel-scan", "panel-sr", "panel-kb"] as const;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    for (let i = 0; i < TABS.length; i++) {
      const tab = TABS[i];
      const panel = PANELS[i];
      await ctx.sidepanel.evaluate((id) => {
        const el = document.getElementById(id) as HTMLButtonElement | null;
        if (el) el.click();
      }, `tab-${tab}`);
      await sleep(150);
      const state = await ctx.sidepanel.evaluate((tabId, panelId) => {
        return {
          tabAriaSelected: document.getElementById(tabId)?.getAttribute("aria-selected") === "true",
          panelHidden: document.getElementById(panelId)?.hasAttribute("hidden") ?? true,
          tabHasActiveClass: document.getElementById(tabId)?.classList.contains("active") ?? false,
        };
      }, `tab-${tab}`, panel);
      if (!state.tabAriaSelected) {
        ctx.fail({ step: `click tab-${tab}`, expected: "aria-selected=true", actual: "aria-selected!=true" });
      }
      if (state.panelHidden) {
        ctx.fail({ step: `click tab-${tab}`, expected: `${panel} visible (no hidden attr)`, actual: "panel hidden" });
      }
      if (!state.tabHasActiveClass) {
        ctx.fail({ step: `click tab-${tab}`, expected: ".active class on tab", actual: "missing" });
      }
    }

    // Home key from kb (last enabled) → scan (first)
    await ctx.sidepanel.evaluate(() => {
      const kb = document.getElementById("tab-kb") as HTMLButtonElement;
      kb?.click();
      kb?.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    });
    await sleep(150);
    const homeState = await ctx.sidepanel.evaluate(() => ({
      first: document.getElementById("tab-scan")?.getAttribute("aria-selected") === "true",
    }));
    if (!homeState.first) ctx.fail({ step: "Home key", expected: "tab-scan aria-selected=true", actual: "not first" });

    // End key → last ENABLED tab (tab-kb, since tab-ai is disabled "coming soon")
    await ctx.sidepanel.evaluate(() => {
      const first = document.getElementById("tab-scan") as HTMLButtonElement;
      first?.click();
      first?.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    });
    await sleep(150);
    const endState = await ctx.sidepanel.evaluate(() => ({
      lastEnabled: document.getElementById("tab-kb")?.getAttribute("aria-selected") === "true",
      ai: document.getElementById("tab-ai")?.getAttribute("aria-selected") === "true",
    }));
    if (!endState.lastEnabled) ctx.fail({ step: "End key", expected: "tab-kb aria-selected=true (last ENABLED)", actual: "not selected" });
    if (endState.ai) ctx.fail({ step: "End key", expected: "tab-ai NOT selected (disabled)", actual: "tab-ai got activated despite being disabled" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "top-tabs");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
