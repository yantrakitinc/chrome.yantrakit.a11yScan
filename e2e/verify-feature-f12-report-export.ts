/**
 * Verify: F12 report export.
 * Inventory: docs/test-matrix/features/f12-report-export.md
 *
 * Asserts:
 *  - Each export button (json/html/pdf/copy) is rendered after a scan
 *  - export-json + export-html call URL.createObjectURL (download intent)
 *  - export-pdf calls window.open
 *  - export-copy calls navigator.clipboard.writeText
 *
 * (Real download bytes / PDF render quality intentionally not verified — Gap.)
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F12 fixture</h1><img src="/x.jpg"></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector("#export-json", { timeout: 30000 });
    } catch {
      ctx.fail({ step: "scan", expected: "export bar after scan", actual: "timeout" });
      throw new Error("scan-timeout");
    }

    // Spy on URL.createObjectURL + window.open + navigator.clipboard
    await ctx.sidepanel.evaluate(`(function(){
      window.__verifyCreates = 0;
      window.__verifyOpens = 0;
      window.__verifyClipboards = 0;
      var origCreate = URL.createObjectURL;
      URL.createObjectURL = function(){ window.__verifyCreates++; return origCreate.apply(URL, arguments); };
      var origOpen = window.open;
      window.open = function(){ window.__verifyOpens++; return origOpen.apply(window, arguments); };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: function(){ window.__verifyClipboards++; return Promise.resolve(); } },
      });
    })()`);

    const buttons = await ctx.sidepanel.evaluate(() => ({
      json: !!document.getElementById("export-json"),
      html: !!document.getElementById("export-html"),
      pdf: !!document.getElementById("export-pdf"),
      copy: !!document.getElementById("export-copy"),
    }));
    if (!buttons.json) ctx.fail({ step: "export buttons", expected: "#export-json", actual: "missing" });
    if (!buttons.html) ctx.fail({ step: "export buttons", expected: "#export-html", actual: "missing" });
    if (!buttons.pdf) ctx.fail({ step: "export buttons", expected: "#export-pdf", actual: "missing" });
    if (!buttons.copy) ctx.fail({ step: "export buttons", expected: "#export-copy", actual: "missing" });

    await ctx.sidepanel.evaluate(() => (document.getElementById("export-json") as HTMLButtonElement).click());
    await sleep(150);
    await ctx.sidepanel.evaluate(() => (document.getElementById("export-html") as HTMLButtonElement).click());
    await sleep(150);
    await ctx.sidepanel.evaluate(() => (document.getElementById("export-pdf") as HTMLButtonElement).click());
    await sleep(300);
    await ctx.sidepanel.evaluate(() => (document.getElementById("export-copy") as HTMLButtonElement).click());
    await sleep(300);

    const counts = await ctx.sidepanel.evaluate(() => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      creates: (window as any).__verifyCreates,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      opens: (window as any).__verifyOpens,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      clipboards: (window as any).__verifyClipboards,
    }));
    if (counts.creates < 2) ctx.fail({ step: "export-json + export-html", expected: "≥2 URL.createObjectURL calls", actual: String(counts.creates) });
    if (counts.opens < 1) ctx.fail({ step: "export-pdf", expected: "≥1 window.open call", actual: String(counts.opens) });
    if (counts.clipboards < 1) ctx.fail({ step: "export-copy", expected: "≥1 clipboard.writeText", actual: String(counts.clipboards) });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f12-report-export");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
