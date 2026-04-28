/**
 * Visual verification — closes audit item 2.
 *
 * Removed the `.classList.toggle("active")` line on .tab-panel from
 * switchTab. The CSS only had `.tab-panel[hidden] { display: none }` as the
 * visibility rule, so the `.active` class was dead code.
 *
 * This script confirms tab switching still works after removal: clicking
 * each top-level tab makes the matching panel visible (display !== "none")
 * and hides the others.
 */

import { launchWithExtension } from "./helpers";

async function main(): Promise<void> {
  const { browser, sidepanel } = await launchWithExtension();
  try {
    await sidepanel.waitForSelector("#tab-panels", { timeout: 10000 });

    const tabs = ["scan", "sr", "kb"]; // ai is disabled (Coming Soon)

    for (const t of tabs) {
      await sidepanel.click(`#tab-${t}`);
      // Allow the click handler + render to run.
      await new Promise((r) => setTimeout(r, 100));

      const visibility = await sidepanel.evaluate((activeId) => {
        const panels = ["scan", "sr", "kb", "ai"];
        return panels.reduce<Record<string, { display: string; hidden: boolean }>>((acc, id) => {
          const el = document.getElementById(`panel-${id}`);
          if (el) {
            acc[id] = {
              display: getComputedStyle(el).display,
              hidden: el.hasAttribute("hidden"),
            };
          }
          return acc;
        }, {});
      }, t);

      const activePanel = visibility[t];
      if (!activePanel) throw new Error(`panel-${t} not in DOM`);
      if (activePanel.hidden) throw new Error(`panel-${t} should not be hidden after clicking tab-${t}`);
      if (activePanel.display === "none") throw new Error(`panel-${t} display:none after clicking tab-${t}`);

      const others = Object.entries(visibility).filter(([id]) => id !== t);
      for (const [id, v] of others) {
        if (!v.hidden && v.display !== "none") {
          throw new Error(`panel-${id} should be hidden when panel-${t} is active`);
        }
      }
      console.log(`✓ tab-${t} → panel-${t} visible (display: ${activePanel.display}), others hidden`);
    }

    console.log("\n✅ Audit item 2 verified: tab switching still works without the dead .active class.\n");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error("\n❌ Verification failed:", err);
  process.exit(1);
});
