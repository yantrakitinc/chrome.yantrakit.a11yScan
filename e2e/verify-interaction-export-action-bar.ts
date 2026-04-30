/**
 * Verify: export-action-bar interaction.
 * Inventory: docs/test-matrix/interactions/export-action-bar.md
 *
 * Asserts:
 *  - Export buttons render after scan
 *  - export-json + export-html click create object URLs (download intent)
 *  - export-pdf click opens print window OR shows "Popup blocked"
 *  - export-copy click writes to navigator.clipboard
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Export fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    await ctx.sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await ctx.sidepanel.waitForSelector('#export-json', { timeout: 30000 });
    } catch {
      ctx.fail({ step: "wait-for-export-bar", expected: "#export-json", actual: "timeout" });
      throw new Error("toolbar-timeout");
    }

    // Spy on URL.createObjectURL + window.open + navigator.clipboard.writeText.
    // Use string-based evaluate to avoid tsx esbuild's __name() helper which
    // isn't defined in the page context.
    await ctx.sidepanel.evaluate(`(function(){
      window.__verifyCreates = 0;
      window.__verifyOpens = 0;
      window.__verifyClipboards = 0;
      var origCreate = URL.createObjectURL;
      URL.createObjectURL = function(){ window.__verifyCreates++; return origCreate.apply(URL, arguments); };
      // Stub window.open completely — DON'T pass through to the real
      // implementation. Real window.open + win.document.write + win.print()
      // pops a system print dialog that blocks subsequent puppeteer evaluates
      // (CDP timeout). Returning null is harmless for this test — we only
      // count the call. (The handler treats null as "popup blocked" and shows
      // a transient label change, which we do not assert here.)
      window.open = function(){ window.__verifyOpens++; return null; };
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: function(s){ window.__verifyClipboards++; return Promise.resolve(); } },
      });
    })()`);

    // Click each
    await ctx.sidepanel.evaluate(() => (document.getElementById("export-json") as HTMLButtonElement).click());
    await sleep(200);
    await ctx.sidepanel.evaluate(() => (document.getElementById("export-html") as HTMLButtonElement).click());
    await sleep(200);
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
  reportAndExit(ctx, "export-action-bar");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
