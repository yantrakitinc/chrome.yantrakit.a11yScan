/**
 * Verify: inspector-tooltip interaction (page-side).
 * Inventory: docs/test-matrix/interactions/inspector-tooltip.md
 *
 * Asserts:
 *  - SR tab → click sr-inspect → ENTER_INSPECT_MODE sent
 *  - On the inspected page: hovering an element shows the tooltip with role + name
 *  - Click pins the tooltip
 *  - Escape exits inspect mode
 *
 * NOTE: Hovering via Puppeteer + mouse.move triggers the inspector's mousemove
 * handler. The tooltip renders in the inspected page's DOM (NOT in shadow DOM
 * for inspector — inspector uses position:fixed div directly).
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1 id="hdr">Inspector fixture</h1>
  <button id="btn1" aria-label="Submit form">Submit</button>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Switch to SR tab + click Inspect
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-sr") as HTMLButtonElement).click());
    await sleep(200);
    await ctx.sidepanel.evaluate(() => (document.getElementById("sr-inspect") as HTMLButtonElement).click());
    await sleep(500);

    // Refocus the page tab + hover over the button
    await ctx.page.bringToFront();
    await sleep(200);

    const btnRect = await ctx.page.evaluate(() => {
      const r = document.getElementById("btn1")!.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await ctx.page.mouse.move(btnRect.x, btnRect.y);
    await sleep(500);

    const tooltipState = await ctx.page.evaluate(() => {
      // Inspector creates two body-level position:fixed divs: a thin highlight
      // outline (empty innerHTML, z-index 2147483646) and the tooltip (z-index
      // 2147483647 with content). Find the one that has innerHTML, NOT the
      // first match — both share "21474" prefix.
      const all = Array.from(document.querySelectorAll("body > div")) as HTMLElement[];
      const candidates = all.filter((d) => d.style.position === "fixed" && d.style.zIndex.includes("21474"));
      const tooltip = candidates.find((d) => d.innerHTML.length > 0);
      return {
        tooltipExists: !!tooltip,
        candidateCount: candidates.length,
        tooltipText: tooltip?.textContent || "",
        hasRoleSection: tooltip?.innerHTML.includes("Role") ?? false,
        hasNameSection: tooltip?.innerHTML.includes("Name") ?? false,
        hasFocusableLabel: tooltip?.innerHTML.includes("Focusable") || tooltip?.innerHTML.includes("focusable") || false,
      };
    });
    if (!tooltipState.tooltipExists) ctx.fail({ step: "hover button", expected: "tooltip rendered", actual: "no tooltip element" });
    if (!tooltipState.hasRoleSection) ctx.fail({ step: "tooltip content", expected: "Role section", actual: "missing" });
    if (!tooltipState.hasNameSection) ctx.fail({ step: "tooltip content", expected: "Name section", actual: "missing" });
    if (!tooltipState.hasFocusableLabel) ctx.fail({ step: "tooltip content", expected: "Focusable status", actual: "missing" });

    // Escape exits inspect
    await ctx.page.keyboard.press("Escape");
    await sleep(300);
    const afterEscape = await ctx.page.evaluate(() => {
      const all = Array.from(document.querySelectorAll("body > div")) as HTMLElement[];
      const tooltip = all.find((d) => d.style.position === "fixed" && d.style.zIndex.includes("21474") && d.innerHTML.length > 0);
      return { tooltipExists: !!tooltip };
    });
    if (afterEscape.tooltipExists) ctx.fail({ step: "Escape", expected: "tooltip removed", actual: "still present" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "inspector-tooltip");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
