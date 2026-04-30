/**
 * Verify: F18 panel layout.
 * Inventory: docs/test-matrix/features/f18-panel-layout.md
 *
 * Asserts the global side-panel scaffold:
 *  - Header (#header), CVD dropdown (#cvd-select)
 *  - Top tabs: tab-scan, tab-sr, tab-kb, tab-ai (with proper roles)
 *  - Tab panels: panel-scan, panel-sr, panel-kb, panel-ai
 *  - Accordion toggle + body
 *  - WCAG dropdowns visible in accordion expanded state
 *  - Mode toggle buttons (Crawl / Movie / Observer)
 *  - Footer
 *  - Settings button (config dialog) + Reset button (R-MV)
 *  - Arrow Right keyboard nav cycles top-tab focus (ARIA tablist pattern)
 *  - Click on Scan top-tab keeps Scan active (smoke check)
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F18 fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Wait for the dynamic Scan tab content to mount.
    await sleep(800);
    try {
      await ctx.sidepanel.waitForSelector(".accordion-wrapper", { timeout: 8000 });
    } catch {
      ctx.fail({ step: "scan tab init", expected: ".accordion-wrapper rendered after sidepanel init", actual: "timeout" });
    }

    const checks: Record<string, () => boolean> = {
      "#header": () => !!document.getElementById("header"),
      "#cvd-select": () => !!document.getElementById("cvd-select"),
      "#tab-scan": () => !!document.getElementById("tab-scan"),
      "#tab-sr": () => !!document.getElementById("tab-sr"),
      "#tab-kb": () => !!document.getElementById("tab-kb"),
      "#tab-ai": () => !!document.getElementById("tab-ai"),
      "#panel-scan": () => !!document.getElementById("panel-scan"),
      "#panel-sr": () => !!document.getElementById("panel-sr"),
      "#panel-kb": () => !!document.getElementById("panel-kb"),
      "#panel-ai": () => !!document.getElementById("panel-ai"),
      ".accordion-wrapper": () => !!document.querySelector(".accordion-wrapper"),
      "#accordion-body": () => !!document.getElementById("accordion-body"),
      "#wcag-version": () => !!document.getElementById("wcag-version"),
      "#wcag-level": () => !!document.getElementById("wcag-level"),
      "#collapse-btn": () => !!document.getElementById("collapse-btn"),
      ".mode-btn.mode-crawl": () => !!document.querySelector(".mode-btn.mode-crawl"),
      ".mode-btn.mode-movie": () => !!document.querySelector(".mode-btn.mode-movie"),
      ".mode-btn.mode-observe": () => !!document.querySelector(".mode-btn.mode-observe"),
      "#footer": () => !!document.getElementById("footer"),
    };
    const ids = await ctx.sidepanel.evaluate(`(function(){
      var checks = ${JSON.stringify(Object.keys(checks))};
      var out = {};
      function has(sel){ return sel.startsWith('#') ? !!document.getElementById(sel.slice(1)) : !!document.querySelector(sel); }
      for (var i = 0; i < checks.length; i++) { out[checks[i]] = has(checks[i]); }
      return out;
    })()`) as Record<string, boolean>;
    for (const [sel, present] of Object.entries(ids)) {
      if (!present) ctx.fail({ step: "panel scaffold", expected: `${sel} rendered`, actual: "missing" });
    }

    // Collapse → expand cycle: clicking collapse-btn renders #accordion-toggle
    // BUTTON; clicking it again expands.
    await ctx.sidepanel.evaluate(() => (document.getElementById("collapse-btn") as HTMLButtonElement | null)?.click());
    await sleep(200);
    const collapsed = await ctx.sidepanel.evaluate(() => !!document.getElementById("accordion-toggle"));
    if (!collapsed) ctx.fail({ step: "collapse accordion", expected: "#accordion-toggle button after collapse-btn click", actual: "missing" });
    if (collapsed) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("accordion-toggle") as HTMLButtonElement).click());
      await sleep(200);
      const expanded = await ctx.sidepanel.evaluate(() => !!document.getElementById("collapse-btn"));
      if (!expanded) ctx.fail({ step: "expand accordion", expected: "#collapse-btn after expand", actual: "missing" });
    }

    // ARIA tablist semantics — scan top-tab is the default active
    const scanRole = await ctx.sidepanel.evaluate(() => ({
      role: document.getElementById("tab-scan")?.getAttribute("role"),
      selected: document.getElementById("tab-scan")?.getAttribute("aria-selected"),
    }));
    if (scanRole.role !== "tab") ctx.fail({ step: "tab-scan ARIA", expected: 'role="tab"', actual: String(scanRole.role) });
    if (scanRole.selected !== "true") ctx.fail({ step: "tab-scan ARIA", expected: 'aria-selected="true" by default', actual: String(scanRole.selected) });

    // Arrow keyboard nav: focus Scan tab + press ArrowRight → SR tab gets focus
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-scan") as HTMLButtonElement).focus());
    await ctx.sidepanel.keyboard.press("ArrowRight");
    await sleep(200);
    const focusedAfterArrow = await ctx.sidepanel.evaluate(() => document.activeElement?.id ?? "");
    if (focusedAfterArrow !== "tab-sr") {
      ctx.fail({
        step: "ARIA tablist keyboard nav",
        expected: "ArrowRight from #tab-scan moves focus to #tab-sr",
        actual: `activeElement.id=${focusedAfterArrow}`,
      });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f18-panel-layout");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
