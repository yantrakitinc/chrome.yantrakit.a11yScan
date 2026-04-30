/**
 * Verify: highlight-toolbar interaction.
 * Inventory: docs/test-matrix/interactions/highlight-toolbar.md
 *
 * Asserts:
 *  - Toolbar renders after scan
 *  - #toggle-violations exists
 *  - Click toggle-violations → aria-pressed=true + .active class
 *  - Click again → aria-pressed=false + no .active class
 *  - Computed background changes between active/inactive (paint check, not just classlist)
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>Toolbar fixture</h1>
  <img src="/x.jpg">
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector('#toggle-violations', { timeout: 30000 });
    } catch {
      ctx.fail({ step: "wait-for-toolbar", expected: "#toggle-violations rendered", actual: "timeout" });
      throw new Error("toolbar-timeout");
    }

    const initial = await ctx.sidepanel.evaluate(() => {
      const btn = document.getElementById("toggle-violations") as HTMLButtonElement;
      const cs = getComputedStyle(btn);
      return {
        pressed: btn.getAttribute("aria-pressed"),
        hasActive: btn.classList.contains("active"),
        bg: cs.backgroundColor,
      };
    });

    // Click ON. Wait long enough for the .15s background transition to settle.
    // Then move mouse off the button so we don't read the :hover state.
    await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-violations") as HTMLButtonElement).click());
    await ctx.sidepanel.mouse.move(0, 0);
    await sleep(500);
    // Force a reflow + read fresh
    const on = await ctx.sidepanel.evaluate(() => {
      const btn = document.getElementById("toggle-violations") as HTMLButtonElement;
      // Force layout — Chrome was returning a stale background-color from getComputedStyle
      // without this nudge after a class-only style change.
      void btn.offsetHeight;
      const cs = getComputedStyle(btn);
      return {
        pressed: btn.getAttribute("aria-pressed"),
        hasActive: btn.classList.contains("active"),
        bg: cs.backgroundColor,
        color: cs.color,
        border: cs.borderColor,
      };
    });
    if (on.pressed !== "true") ctx.fail({ step: "click on", expected: "aria-pressed=true", actual: String(on.pressed) });
    if (!on.hasActive) ctx.fail({ step: "click on", expected: ".active class", actual: "missing" });
    // Background must DIFFER from initial — proves the .active rule paints
    if (on.bg === initial.bg) ctx.fail({ step: "paint check on", expected: "computed background-color differs from initial", actual: `both ${on.bg} (CSS rule for .toolbar-btn.active missing or overridden)` });

    // Click OFF
    await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-violations") as HTMLButtonElement).click());
    await sleep(200);
    const off = await ctx.sidepanel.evaluate(() => {
      const btn = document.getElementById("toggle-violations") as HTMLButtonElement;
      const cs = getComputedStyle(btn);
      return {
        pressed: btn.getAttribute("aria-pressed"),
        hasActive: btn.classList.contains("active"),
        bg: cs.backgroundColor,
      };
    });
    if (off.pressed !== "false") ctx.fail({ step: "click off", expected: "aria-pressed=false", actual: String(off.pressed) });
    if (off.hasActive) ctx.fail({ step: "click off", expected: "no .active class", actual: "still present" });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "highlight-toolbar");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
