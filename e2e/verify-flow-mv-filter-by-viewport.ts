/**
 * Verify flow: Multi-viewport scan → filter results by viewport chip.
 * Inventory: docs/test-matrix/flows/mv-filter-by-viewport.md
 *
 * Lightweight check — drives an MV scan and verifies that:
 *  - mv-filter-chip elements render after results
 *  - Clicking a chip toggles aria-pressed
 *
 * (Per-viewport diff classification + window resize behavior are covered by
 * unit tests in src/background/__tests__/multi-viewport.test.ts.)
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>MV filter fixture</h1>
  <img src="/x.jpg">
  <button></button>
</body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("mv-check") as HTMLInputElement).click());
    await sleep(150);

    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try { await ctx.sidepanel.waitForSelector("#scan-content details", { timeout: 90000 }); }
    catch { ctx.fail({ step: "MV scan", expected: "results render", actual: "timeout" }); throw new Error("scan-timeout"); }

    const initial = await ctx.sidepanel.evaluate(() => {
      const chips = Array.from(document.querySelectorAll(".mv-filter-chip, [data-mvfilter]")) as HTMLElement[];
      return {
        chipCount: chips.length,
        chipDataValues: chips.map((c) => c.getAttribute("data-mvfilter") ?? c.textContent?.trim()).filter(Boolean),
      };
    });
    if (initial.chipCount === 0) {
      ctx.fail({
        step: "MV chips render",
        expected: "≥1 .mv-filter-chip / [data-mvfilter] post-scan",
        actual: "no chips found — MV diff may have produced empty viewportSpecific array (fixture too simple) or class names changed",
      });
      // Non-fatal — continue with smoke check below
    }

    if (initial.chipCount > 0) {
      // Step 4 — click first non-"all" chip → it becomes pressed
      await ctx.sidepanel.evaluate(() => {
        const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip, [data-mvfilter]"));
        const target = chips.find((c) => (c.getAttribute("data-mvfilter") ?? "").toLowerCase() !== "all") || chips[0];
        target?.click();
      });
      await sleep(300);
      const firstClick = await ctx.sidepanel.evaluate(() => {
        const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip, [data-mvfilter]"));
        return chips.map((c) => ({
          filter: c.getAttribute("data-mvfilter") ?? c.textContent?.trim() ?? "",
          pressed: c.getAttribute("aria-pressed"),
        }));
      });
      const pressedAfterFirst = firstClick.filter((c) => c.pressed === "true");
      if (pressedAfterFirst.length !== 1) {
        ctx.fail({ step: "first chip click (step 4)", expected: "exactly 1 chip aria-pressed=true", actual: `${pressedAfterFirst.length} pressed` });
      }
      const firstPressed = pressedAfterFirst[0]?.filter ?? "";

      // Step 5 — click a DIFFERENT non-"all" chip → press flips
      const otherChip = firstClick.find((c) =>
        c.filter.toLowerCase() !== firstPressed.toLowerCase() &&
        c.filter.toLowerCase() !== "all" &&
        c.filter !== ""
      );
      if (otherChip) {
        await ctx.sidepanel.evaluate((target) => {
          const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip, [data-mvfilter]"));
          const t = chips.find((c) => (c.getAttribute("data-mvfilter") ?? c.textContent?.trim() ?? "") === target);
          t?.click();
        }, otherChip.filter);
        await sleep(300);
        const secondClick = await ctx.sidepanel.evaluate(() => {
          const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip, [data-mvfilter]"));
          return chips.find((c) => c.getAttribute("aria-pressed") === "true");
        }) as { filter?: string } | null;
        const newPressedFilter =
          (secondClick && (secondClick as unknown as { textContent?: string }).textContent) ||
          (await ctx.sidepanel.evaluate(() => {
            const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip, [data-mvfilter]"));
            const p = chips.find((c) => c.getAttribute("aria-pressed") === "true");
            return p?.getAttribute("data-mvfilter") ?? p?.textContent?.trim() ?? "";
          }));
        if (typeof newPressedFilter === "string" && newPressedFilter.toLowerCase() === firstPressed.toLowerCase()) {
          ctx.fail({ step: "second chip click (step 5)", expected: "press transferred to the second chip", actual: "still on first" });
        }
      }

      // Step 6 — click the "all" chip → "all" pressed, others not
      const hasAll = firstClick.some((c) => c.filter.toLowerCase() === "all");
      if (hasAll) {
        await ctx.sidepanel.evaluate(() => {
          const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip, [data-mvfilter]"));
          const allChip = chips.find((c) => (c.getAttribute("data-mvfilter") ?? c.textContent?.trim() ?? "").toLowerCase() === "all");
          allChip?.click();
        });
        await sleep(300);
        const allState = await ctx.sidepanel.evaluate(() => {
          const chips = Array.from(document.querySelectorAll<HTMLButtonElement>(".mv-filter-chip, [data-mvfilter]"));
          return chips.map((c) => ({
            filter: c.getAttribute("data-mvfilter") ?? c.textContent?.trim() ?? "",
            pressed: c.getAttribute("aria-pressed"),
          }));
        });
        const allPressed = allState.find((c) => c.filter.toLowerCase() === "all" && c.pressed === "true");
        if (!allPressed) {
          ctx.fail({ step: "all chip click (step 6)", expected: "All chip aria-pressed=true", actual: "not pressed" });
        }
      }

      // Step 7 — click Clear → mvViewportFilter resets, chips disappear
      const hasClear = await ctx.sidepanel.evaluate(() => !!document.getElementById("clear-btn"));
      if (hasClear) {
        await ctx.sidepanel.evaluate(() => (document.getElementById("clear-btn") as HTMLButtonElement).click());
        await sleep(500);
        const afterClear = await ctx.sidepanel.evaluate(() => ({
          chipCount: document.querySelectorAll(".mv-filter-chip, [data-mvfilter]").length,
          hasResults: !!document.querySelector("#scan-content details"),
        }));
        if (afterClear.hasResults) {
          ctx.fail({ step: "clear after MV (step 7)", expected: "results wiped", actual: "still rendered" });
        }
        if (afterClear.chipCount !== 0) {
          ctx.fail({ step: "clear after MV (step 7)", expected: "chips removed", actual: String(afterClear.chipCount) });
        }
      }
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "flow-mv-filter-by-viewport");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
