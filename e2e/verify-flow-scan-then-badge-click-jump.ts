/**
 * Verify flow: Scan → toggle violations → click badge #2 → side panel
 * activates Results sub-tab + selects scan tab.
 * Inventory: docs/test-matrix/flows/scan-then-badge-click-jump.md
 *
 * Builds on verify-interaction-visual-overlays.ts but tracks the FULL flow:
 * scan → ON → badge click → tab switch → re-render lands on Results sub-tab.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>Badge-click flow fixture</h1>
  <img src="/x.jpg" id="bad-img-1">
  <img src="/y.jpg" id="bad-img-2">
  <button id="bad-btn-1"></button>
  <button id="bad-btn-2"></button>
  <a href="#" id="bad-link"></a>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector("#toggle-violations", { timeout: 30000 }); }
    catch { ctx.fail({ step: "scan", expected: "toolbar after scan", actual: "timeout" }); throw new Error("scan-timeout"); }

    await ctx.sidepanel.evaluate(() => (document.getElementById("toggle-violations") as HTMLButtonElement).click());
    await ctx.page.bringToFront();
    await sleep(700);

    const overlay = await ctx.page.evaluate(() => {
      const shadow = document.getElementById("a11y-scan-overlay-host")?.shadowRoot;
      const container = shadow?.getElementById("violation-overlay");
      const children = container ? Array.from(container.children) as HTMLElement[] : [];
      const badges = children.filter((c) => c.textContent && /^\d+$/.test(c.textContent.trim()));
      const numbers = badges.map((b) => Number(b.textContent!.trim()));
      return { count: badges.length, numbers };
    });
    if (overlay.count < 2) {
      ctx.fail({ step: "overlay badges", expected: "≥2 badges to test sequential indexing", actual: String(overlay.count) });
      return;
    }
    const expectedSequence = overlay.numbers.map((_, i) => i + 1);
    const sequential = overlay.numbers.every((n, i) => n === expectedSequence[i]);
    if (!sequential) {
      ctx.fail({ step: "badge sequence", expected: JSON.stringify(expectedSequence), actual: JSON.stringify(overlay.numbers) });
    }

    // Park the sidepanel on a different top-tab so the badge click → tab switch
    // is observable.
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-sr") as HTMLButtonElement).click());
    await sleep(300);

    // Click badge #2 inside the shadow root
    await ctx.page.evaluate(() => {
      const shadow = document.getElementById("a11y-scan-overlay-host")!.shadowRoot!;
      const container = shadow.getElementById("violation-overlay")!;
      const badges = (Array.from(container.children) as HTMLElement[]).filter((c) => c.textContent && /^\d+$/.test(c.textContent.trim()));
      const target = badges.find((b) => b.textContent!.trim() === "2");
      if (!target) throw new Error("badge#2 not found");
      target.click();
    });
    await sleep(700);

    const after = await ctx.sidepanel.evaluate(() => ({
      activeTopTab: document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? "",
      resultsSubSelected: document.querySelector('[data-subtab="results"]')?.getAttribute("aria-selected") ?? "",
    }));
    if (after.activeTopTab !== "tab-scan") {
      ctx.fail({ step: "badge click → top-tab", expected: "tab-scan re-selected by VIOLATION_BADGE_CLICKED handler", actual: after.activeTopTab });
    }
    if (after.resultsSubSelected !== "true") {
      ctx.fail({ step: "badge click → sub-tab", expected: "Results sub-tab aria-selected=true", actual: after.resultsSubSelected });
    }

    // Click badge #1 — different index → still works
    await ctx.sidepanel.evaluate(() => (document.getElementById("tab-sr") as HTMLButtonElement).click());
    await sleep(200);
    await ctx.page.evaluate(() => {
      const shadow = document.getElementById("a11y-scan-overlay-host")!.shadowRoot!;
      const container = shadow.getElementById("violation-overlay")!;
      const badges = (Array.from(container.children) as HTMLElement[]).filter((c) => c.textContent && /^\d+$/.test(c.textContent.trim()));
      const target = badges.find((b) => b.textContent!.trim() === "1");
      target?.click();
    });
    await sleep(700);
    const second = await ctx.sidepanel.evaluate(() => ({
      activeTopTab: document.querySelector('[role="tab"][aria-selected="true"]')?.id ?? "",
    }));
    if (second.activeTopTab !== "tab-scan") {
      ctx.fail({ step: "badge#1 click → top-tab", expected: "tab-scan re-selected", actual: second.activeTopTab });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-scan-then-badge-click-jump");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
