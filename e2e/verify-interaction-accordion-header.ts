/**
 * Verify: accordion-header interaction.
 * Inventory: docs/test-matrix/interactions/accordion-header.md
 *
 * Asserts:
 *  - Initial state: accordion expanded → collapse-btn visible
 *  - Click collapse-btn → accordion-body has [hidden]
 *  - Click accordion-toggle (collapsed) → accordion-body shows
 *  - Mode toggles flip aria-pressed
 *  - WCAG dropdowns update state
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Accordion fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Initial: accordion expanded → collapse-btn exists
    const initial = await ctx.sidepanel.evaluate(() => ({
      collapseBtnExists: !!document.getElementById("collapse-btn"),
      accordionToggleIsButton: document.getElementById("accordion-toggle")?.tagName === "BUTTON",
    }));
    if (!initial.collapseBtnExists) ctx.fail({ step: "initial state", expected: "collapse-btn present (accordion expanded)", actual: "collapse-btn missing" });

    // Click collapse-btn
    await ctx.sidepanel.evaluate(() => (document.getElementById("collapse-btn") as HTMLButtonElement | null)?.click());
    await sleep(150);
    const collapsed = await ctx.sidepanel.evaluate(() => ({
      bodyHidden: document.getElementById("accordion-body")?.hasAttribute("hidden") ?? false,
      toggleIsButton: document.getElementById("accordion-toggle")?.tagName === "BUTTON",
    }));
    if (!collapsed.bodyHidden) ctx.fail({ step: "click collapse-btn", expected: "accordion-body has [hidden]", actual: "not hidden" });
    if (!collapsed.toggleIsButton) ctx.fail({ step: "click collapse-btn", expected: "accordion-toggle becomes button", actual: "not a button" });

    // Click accordion-toggle (collapsed → expand)
    await ctx.sidepanel.evaluate(() => (document.getElementById("accordion-toggle") as HTMLButtonElement | null)?.click());
    await sleep(150);
    const expanded = await ctx.sidepanel.evaluate(() => ({
      bodyVisible: !(document.getElementById("accordion-body")?.hasAttribute("hidden") ?? false),
      collapseBtn: !!document.getElementById("collapse-btn"),
    }));
    if (!expanded.bodyVisible) ctx.fail({ step: "click accordion-toggle (collapsed)", expected: "accordion-body visible", actual: "still hidden" });
    if (!expanded.collapseBtn) ctx.fail({ step: "click accordion-toggle (collapsed)", expected: "collapse-btn visible", actual: "missing" });

    // Click crawl mode toggle
    await ctx.sidepanel.evaluate(() => (document.querySelector('.mode-btn[data-mode="crawl"]') as HTMLButtonElement | null)?.click());
    await sleep(150);
    const crawlState = await ctx.sidepanel.evaluate(() => ({
      pressed: document.querySelector('.mode-btn[data-mode="crawl"]')?.getAttribute("aria-pressed"),
    }));
    if (crawlState.pressed !== "true") ctx.fail({ step: "click crawl mode-btn", expected: "aria-pressed=true", actual: String(crawlState.pressed) });

    // WCAG dropdown change
    await ctx.sidepanel.evaluate(() => {
      const sel = document.getElementById("wcag-version") as HTMLSelectElement | null;
      if (sel) {
        sel.value = "2.1";
        sel.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await sleep(150);
    const wcagState = await ctx.sidepanel.evaluate(() => ({
      version: (document.getElementById("wcag-version") as HTMLSelectElement | null)?.value,
    }));
    if (wcagState.version !== "2.1") ctx.fail({ step: "wcag-version change to 2.1", expected: "value=2.1", actual: String(wcagState.version) });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "accordion-header");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
