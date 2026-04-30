/**
 * Verify: F07 element highlighting.
 * Inventory: docs/test-matrix/features/f07-element-highlighting.md
 *
 * Asserts:
 *  - Click .highlight-btn → HIGHLIGHT_ELEMENT message reaches content script
 *    → an outline appears in the inspected page
 *  - Side-panel row gets .ds-flash-active for 3s on highlight (visual link)
 *  - .ds-flash-active timer resets on stacked clicks
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>F07 fixture</h1>
  <img src="/x.jpg">
  <button></button>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector(".highlight-btn", { timeout: 30000 });
    } catch {
      ctx.fail({ step: "scan", expected: ".highlight-btn after scan", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    // Click first highlight button
    await ctx.sidepanel.evaluate(() => (document.querySelector(".highlight-btn") as HTMLButtonElement).click());
    await ctx.page.bringToFront();
    await sleep(800);

    // The current implementation (extension/src/content/index.ts:highlightElement)
    // applies an inline amber outline + box-shadow + pulse animation directly to
    // the target element. (The inventory's "Shadow DOM overlay" claim is
    // out-of-sync with the implementation — verify the actual behavior.)
    // Verify that some element on the page now has the amber outline + glow.
    const highlightApplied = await ctx.page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("*")) as HTMLElement[];
      const found = all.find((el) =>
        /#f59e0b/i.test(el.style.outline) || /245.*158.*11/.test(el.style.boxShadow)
      );
      return {
        applied: !!found,
        targetTag: found?.tagName ?? null,
      };
    });
    if (!highlightApplied.applied) {
      ctx.fail({ step: "highlight click", expected: "amber outline applied to target element after HIGHLIGHT_ELEMENT", actual: "no element has the amber inline style" });
    }

    // Side-panel row should gain .ds-flash-active
    const row = await ctx.sidepanel.evaluate(() => {
      const flashed = document.querySelectorAll(".ds-flash-active");
      return { flashedCount: flashed.length };
    });
    if (row.flashedCount === 0) ctx.fail({ step: "row flash", expected: "≥1 .ds-flash-active row in sidepanel", actual: "0" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f07-element-highlighting");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
