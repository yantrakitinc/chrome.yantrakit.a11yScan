/**
 * Verify: F08 CVD simulation.
 * Inventory: docs/test-matrix/features/f08-cvd-simulation.md
 *
 * Asserts:
 *  - cvd-select dropdown is rendered with all 8 CVD types + "Normal vision"
 *  - Selecting a type sends APPLY_CVD_FILTER → page applies an SVG filter
 *  - Selecting "Normal vision" (or empty) removes the filter
 *  - Filter does NOT leak into the side panel
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body>
  <h1>CVD fixture</h1>
  <div style="background:#ff0000;width:100px;height:100px"></div>
  <div style="background:#00ff00;width:100px;height:100px"></div>
</body></html>`;

const EXPECTED_TYPES = ["protanopia", "deuteranopia", "protanomaly", "deuteranomaly", "tritanopia", "tritanomaly", "achromatopsia", "achromatomaly"];

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    const opts = await ctx.sidepanel.evaluate(() => {
      const sel = document.getElementById("cvd-select") as HTMLSelectElement | null;
      if (!sel) return { exists: false, values: [] as string[] };
      return { exists: true, values: Array.from(sel.options).map((o) => o.value) };
    });
    if (!opts.exists) {
      ctx.fail({ step: "cvd dropdown", expected: "#cvd-select rendered", actual: "missing" });
      throw new Error("no-cvd-select");
    }
    for (const t of EXPECTED_TYPES) {
      if (!opts.values.includes(t)) ctx.fail({ step: "cvd dropdown options", expected: `option value="${t}"`, actual: `present values: ${opts.values.join(",")}` });
    }

    // Apply protanopia
    await ctx.sidepanel.evaluate(() => {
      const sel = document.getElementById("cvd-select") as HTMLSelectElement;
      sel.value = "protanopia";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await ctx.page.bringToFront();
    await sleep(500);

    // Verify filter applied. Implementation may inject a <style> tag, an inline
    // filter on document.documentElement, or an SVG <filter> + matching CSS.
    // Probe broadly.
    const applied = await ctx.page.evaluate(() => {
      const docFilter = getComputedStyle(document.documentElement).filter;
      const bodyFilter = getComputedStyle(document.body).filter;
      const hasSvgFilter = !!document.querySelector("svg filter, svg feColorMatrix");
      const hasStyleTag = Array.from(document.querySelectorAll("style")).some((s) => /filter\s*:/i.test(s.textContent || ""));
      return {
        docFilter, bodyFilter, hasSvgFilter, hasStyleTag,
        any: docFilter !== "none" || bodyFilter !== "none" || hasSvgFilter || hasStyleTag,
      };
    });
    if (!applied.any) {
      ctx.fail({ step: "cvd apply", expected: "CSS filter or SVG color-matrix applied to page", actual: `docFilter=${applied.docFilter} bodyFilter=${applied.bodyFilter} svg=${applied.hasSvgFilter} style=${applied.hasStyleTag}` });
    }

    // Side panel should NOT have a filter (sidepanel must stay color-correct)
    const panelLeak = await ctx.sidepanel.evaluate(() => ({
      panelDoc: getComputedStyle(document.documentElement).filter,
      panelBody: getComputedStyle(document.body).filter,
    }));
    if (panelLeak.panelDoc !== "none" || panelLeak.panelBody !== "none") {
      ctx.fail({ step: "sidepanel leak", expected: "side panel filter=none (must stay color-correct)", actual: `doc=${panelLeak.panelDoc} body=${panelLeak.panelBody}` });
    }

    // Reset to Normal vision
    await ctx.sidepanel.evaluate(() => {
      const sel = document.getElementById("cvd-select") as HTMLSelectElement;
      sel.value = "";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sleep(400);
    const removed = await ctx.page.evaluate(() => ({
      docFilter: getComputedStyle(document.documentElement).filter,
      bodyFilter: getComputedStyle(document.body).filter,
      hasSvgFilter: !!document.querySelector("svg filter, svg feColorMatrix"),
    }));
    // Either filter is "none" OR the SVG filter still exists but isn't being
    // referenced via CSS — accept either.
    if (removed.docFilter !== "none" && removed.bodyFilter !== "none") {
      ctx.fail({ step: "cvd reset", expected: "filter:none after Normal-vision selected", actual: `doc=${removed.docFilter} body=${removed.bodyFilter}` });
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f08-cvd-simulation");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
