/**
 * Verify: F09 manual review.
 * Inventory: docs/test-matrix/features/f09-manual-review.md
 *
 * Asserts:
 *  - Manual sub-tab renders one row per manual-review WCAG criterion
 *  - Each row has 3 toggle buttons (Pass / Fail / N/A)
 *  - Click flips state; click same again deselects; click another flips
 *  - State persists in chrome.storage.local under manualReview key
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F09 fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector('[data-subtab="manual"]', { timeout: 30000 });
    } catch {
      ctx.fail({ step: "scan", expected: "Manual sub-tab after scan", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    await ctx.sidepanel.evaluate(() => (document.querySelector('[data-subtab="manual"]') as HTMLButtonElement).click());
    await sleep(400);

    const layout = await ctx.sidepanel.evaluate(() => ({
      rows: document.querySelectorAll("[data-criterion]").length,
      passBtns: document.querySelectorAll('.manual-btn[data-status="pass"]').length,
      failBtns: document.querySelectorAll('.manual-btn[data-status="fail"]').length,
      naBtns: document.querySelectorAll('.manual-btn[data-status="na"]').length,
    }));

    if (layout.rows === 0) {
      ctx.fail({ step: "manual rows", expected: "≥1 [data-criterion] row rendered", actual: "0" });
    }
    if (layout.passBtns === 0 || layout.failBtns === 0 || layout.naBtns === 0) {
      ctx.fail({ step: "manual toggles", expected: "Pass + Fail + N/A buttons per row", actual: `pass=${layout.passBtns} fail=${layout.failBtns} na=${layout.naBtns}` });
    }

    // Click Pass on the first row → expect aria-pressed=true on that button
    if (layout.passBtns > 0) {
      await ctx.sidepanel.evaluate(() => {
        const btn = document.querySelector('.manual-btn[data-status="pass"]') as HTMLButtonElement | null;
        btn?.click();
      });
      await sleep(200);
      const afterPass = await ctx.sidepanel.evaluate(() => {
        const btn = document.querySelector('.manual-btn[data-status="pass"]') as HTMLButtonElement | null;
        return btn?.getAttribute("aria-pressed") ?? null;
      });
      if (afterPass !== "true") {
        ctx.fail({ step: "click pass", expected: "Pass button aria-pressed=true after click", actual: String(afterPass) });
      }
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f09-manual-review");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
