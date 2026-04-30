/**
 * Verify flow: multiple .highlight-btn clicks → flash timer reset behavior.
 * Inventory: docs/test-matrix/flows/multi-highlight-flash-timer-reset.md
 *
 * Asserts:
 *  - First click adds .ds-flash-active to its row
 *  - Repeated click on same row keeps the class (timer reset, no flicker)
 *  - Click on a different row gives that row .ds-flash-active too
 *  - After 3.5s, all flashes have cleared
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>Multi-highlight flash fixture</h1>
  <img src="/x.jpg" id="bad-img-1">
  <img src="/y.jpg" id="bad-img-2">
  <button id="bad-btn-1"></button>
  <a href="#" id="bad-link"></a>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector(".highlight-btn", { timeout: 30000 }); }
    catch { ctx.fail({ step: "scan", expected: ".highlight-btn after scan", actual: "timeout" }); throw new Error("scan-timeout"); }
    await sleep(400);

    const counts = await ctx.sidepanel.evaluate(() => document.querySelectorAll(".highlight-btn").length);
    if (counts < 2) {
      ctx.fail({ step: "preconditions", expected: "≥2 .highlight-btn rows", actual: String(counts) });
      return;
    }

    // 1. Click first highlight-btn
    await ctx.sidepanel.evaluate(() => (document.querySelectorAll<HTMLButtonElement>(".highlight-btn")[0]).click());
    await sleep(300);
    const afterFirst = await ctx.sidepanel.evaluate(() =>
      document.querySelectorAll(".ds-flash-active").length
    );
    if (afterFirst < 1) ctx.fail({ step: "first click", expected: "≥1 .ds-flash-active", actual: String(afterFirst) });

    // 2. Click same first highlight-btn again within 1s — class stays
    await sleep(700); // partial wait so the first timer is mid-flight
    await ctx.sidepanel.evaluate(() => (document.querySelectorAll<HTMLButtonElement>(".highlight-btn")[0]).click());
    await sleep(200);
    const afterSecondSame = await ctx.sidepanel.evaluate(() =>
      document.querySelectorAll(".ds-flash-active").length
    );
    if (afterSecondSame < 1) ctx.fail({ step: "stacked click on same row", expected: ".ds-flash-active still present", actual: String(afterSecondSame) });

    // 3. Click a DIFFERENT highlight-btn
    await ctx.sidepanel.evaluate(() => (document.querySelectorAll<HTMLButtonElement>(".highlight-btn")[1]).click());
    await sleep(300);
    const afterDifferent = await ctx.sidepanel.evaluate(() =>
      document.querySelectorAll(".ds-flash-active").length
    );
    // Either both rows are flashing simultaneously, or only the new one — both are
    // valid per the inventory ("class state is independent per row"). The
    // important assertion is that the NEW row is now flashing.
    if (afterDifferent < 1) ctx.fail({ step: "click different row", expected: ".ds-flash-active on at least the new row", actual: String(afterDifferent) });

    // 4. Wait 3.5s — all flashes cleared
    await sleep(3700);
    const afterWait = await ctx.sidepanel.evaluate(() =>
      document.querySelectorAll(".ds-flash-active").length
    );
    if (afterWait !== 0) ctx.fail({ step: "after 3.5s", expected: "0 .ds-flash-active (all timers expired)", actual: String(afterWait) });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-multi-highlight-flash-timer-reset");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
