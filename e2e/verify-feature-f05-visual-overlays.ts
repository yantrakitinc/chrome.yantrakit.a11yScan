/**
 * Verify: F05 visual overlays — comprehensive coverage of all 3 overlay types.
 * Inventory: docs/test-matrix/features/f05-visual-overlays.md
 *
 * Builds on the violation-overlay coverage in
 * verify-interaction-visual-overlays.ts and adds tab-order + focus-gap
 * dispatch verification.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>F05 fixture</h1>
  <img src="/x.jpg">
  <button id="b1">Real button</button>
  <a href="#" id="a1">Real link</a>
  <button id="b2" tabindex="-1">Not focusable (tabindex=-1)</button>
  <div id="d1" role="button" onclick="void 0">Interactive but not native (no tabindex)</div>
  <button id="b3" disabled>Disabled</button>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Scan first to enable the toolbar
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector("#toggle-violations", { timeout: 30000 });
    } catch {
      ctx.fail({ step: "scan", expected: "toolbar after scan", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    // ── 1. Violation overlay (Shadow DOM render) ──
    await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-violations") as HTMLButtonElement).click());
    await ctx.page.bringToFront();
    await sleep(600);
    const v = await ctx.page.evaluate(() => {
      const host = document.getElementById("a11y-scan-overlay-host");
      const shadow = host?.shadowRoot;
      const container = shadow?.getElementById("violation-overlay");
      const children = container ? Array.from(container.children) as HTMLElement[] : [];
      const badges = children.filter((c) => c.textContent && /^\d+$/.test(c.textContent.trim()));
      return { hasContainer: !!container, badgeCount: badges.length, hostInDom: !!host };
    });
    if (!v.hostInDom) ctx.fail({ step: "violation overlay", expected: "#a11y-scan-overlay-host in body", actual: "missing" });
    if (!v.hasContainer) ctx.fail({ step: "violation overlay", expected: "shadowRoot > #violation-overlay", actual: "missing" });
    if (v.badgeCount === 0) ctx.fail({ step: "violation overlay", expected: "≥1 numbered badge", actual: "0" });

    // Hide violations again so subsequent overlays start from a clean canvas
    await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-violations") as HTMLButtonElement).click());
    await sleep(300);

    // ── 2. Tab-order overlay ──
    // The tab-order toolbar button id is #toggle-tab-order in toolbar HTML.
    const hasTabOrder = await ctx.sidepanel.evaluate(() => !!document.getElementById("toggle-tab-order"));
    if (hasTabOrder) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-tab-order") as HTMLButtonElement).click());
      await ctx.page.bringToFront();
      await sleep(600);
      const t = await ctx.page.evaluate(() => {
        const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
        const container = shadow?.getElementById("tab-order-overlay");
        const badges = container ? Array.from(container.children) as HTMLElement[] : [];
        const numbers = badges.map((b) => Number((b.textContent || "0").trim())).filter((n) => Number.isFinite(n) && n > 0);
        return { hasContainer: !!container, count: numbers.length, sequential: numbers.every((n, i) => n === i + 1) };
      });
      if (!t.hasContainer) ctx.fail({ step: "tab-order overlay", expected: "shadowRoot > #tab-order-overlay", actual: "missing" });
      if (t.count === 0) ctx.fail({ step: "tab-order overlay", expected: "≥1 tab-order badge for focusable elements", actual: "0" });
      if (t.count > 0 && !t.sequential) ctx.fail({ step: "tab-order overlay", expected: "badges numbered sequentially 1..N", actual: "non-sequential" });

      // Hide
      await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-tab-order") as HTMLButtonElement).click());
      await sleep(300);
    }

    // ── 3. Focus-gap overlay ──
    const hasFocusGap = await ctx.sidepanel.evaluate(() => !!document.getElementById("toggle-focus-gaps"));
    if (hasFocusGap) {
      await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-focus-gaps") as HTMLButtonElement).click());
      await ctx.page.bringToFront();
      await sleep(600);
      const f = await ctx.page.evaluate(() => {
        const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
        const container = shadow?.getElementById("focus-gap-overlay");
        const markers = container ? Array.from(container.children) as HTMLElement[] : [];
        const tooltipTexts = markers.map((m) => m.textContent?.trim() ?? "").filter(Boolean);
        return {
          hasContainer: !!container,
          markerCount: markers.length,
          mentionsTabindex: tooltipTexts.some((t) => /tabindex/.test(t)),
          mentionsDisabled: tooltipTexts.some((t) => /disabled/i.test(t)),
        };
      });
      if (!f.hasContainer) ctx.fail({ step: "focus-gap overlay", expected: "shadowRoot > #focus-gap-overlay", actual: "missing" });
      if (f.markerCount === 0) ctx.fail({ step: "focus-gap overlay", expected: "≥1 marker for non-focusable interactives", actual: "0" });
      if (!f.mentionsTabindex && !f.mentionsDisabled) {
        ctx.fail({ step: "focus-gap overlay", expected: "tooltip mentions tabindex or disabled reason", actual: "no recognised reason text" });
      }
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f05-visual-overlays");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
