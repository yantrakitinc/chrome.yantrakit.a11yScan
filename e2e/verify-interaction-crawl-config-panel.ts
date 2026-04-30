/**
 * Verify: crawl-config-panel interaction.
 * Inventory: docs/test-matrix/interactions/crawl-config-panel.md
 *
 * Asserts (with Crawl mode toggle ON):
 *  - crawl-mode dropdown switches between follow / urllist
 *  - In urllist mode: url-list-open button visible; click opens url-paste-area + url-manual-input
 *  - url-manual-add adds URL to list (.url-remove-btn appears)
 *  - url-paste-add parses textarea + adds rows
 *  - url-remove-btn removes a row
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>Crawl config fixture</h1></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Enable crawl mode
    await ctx.sidepanel.evaluate(() => (document.querySelector('.mode-btn[data-mode="crawl"]') as HTMLButtonElement | null)?.click());
    await sleep(200);

    const enabled = await ctx.sidepanel.evaluate(() => ({
      hasCrawlMode: !!document.getElementById("crawl-mode"),
    }));
    if (!enabled.hasCrawlMode) ctx.fail({ step: "enable crawl", expected: "#crawl-mode dropdown rendered", actual: "missing" });

    // Switch to urllist
    await ctx.sidepanel.evaluate(() => {
      const sel = document.getElementById("crawl-mode") as HTMLSelectElement;
      sel.value = "urllist";
      sel.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await sleep(200);

    const urllist = await ctx.sidepanel.evaluate(() => ({
      hasOpenBtn: !!document.getElementById("url-list-open"),
    }));
    if (!urllist.hasOpenBtn) ctx.fail({ step: "switch urllist", expected: "#url-list-open visible", actual: "missing" });

    // Open URL list panel
    await ctx.sidepanel.evaluate(() => (document.getElementById("url-list-open") as HTMLButtonElement).click());
    await sleep(200);

    const open = await ctx.sidepanel.evaluate(() => ({
      pasteArea: !!document.getElementById("url-paste-area"),
      pasteAdd: !!document.getElementById("url-paste-add"),
      manualInput: !!document.getElementById("url-manual-input"),
      manualAdd: !!document.getElementById("url-manual-add"),
      done: !!document.getElementById("url-list-done"),
    }));
    if (!open.pasteArea) ctx.fail({ step: "url panel open", expected: "#url-paste-area", actual: "missing" });
    if (!open.pasteAdd) ctx.fail({ step: "url panel open", expected: "#url-paste-add", actual: "missing" });
    if (!open.manualInput) ctx.fail({ step: "url panel open", expected: "#url-manual-input", actual: "missing" });
    if (!open.manualAdd) ctx.fail({ step: "url panel open", expected: "#url-manual-add", actual: "missing" });
    if (!open.done) ctx.fail({ step: "url panel open", expected: "#url-list-done", actual: "missing" });

    // Add a URL via manual input
    await ctx.sidepanel.evaluate(() => {
      const inp = document.getElementById("url-manual-input") as HTMLInputElement;
      inp.value = "https://example.com/foo";
    });
    await ctx.sidepanel.evaluate(() => (document.getElementById("url-manual-add") as HTMLButtonElement).click());
    await sleep(200);

    const afterManual = await ctx.sidepanel.evaluate(() => ({
      removeBtns: document.querySelectorAll(".url-remove-btn").length,
    }));
    if (afterManual.removeBtns === 0) ctx.fail({ step: "manual add", expected: "≥1 .url-remove-btn", actual: "0" });

    // Add 2 more via paste
    await ctx.sidepanel.evaluate(() => {
      const ta = document.getElementById("url-paste-area") as HTMLTextAreaElement;
      ta.value = "https://example.com/a\nhttps://example.com/b";
    });
    await ctx.sidepanel.evaluate(() => (document.getElementById("url-paste-add") as HTMLButtonElement).click());
    await sleep(200);

    const afterPaste = await ctx.sidepanel.evaluate(() => ({
      removeBtns: document.querySelectorAll(".url-remove-btn").length,
    }));
    if (afterPaste.removeBtns < 3) ctx.fail({ step: "paste add", expected: "≥3 .url-remove-btn after manual + 2 paste", actual: String(afterPaste.removeBtns) });

    // Remove first
    await ctx.sidepanel.evaluate(() => (document.querySelector(".url-remove-btn") as HTMLButtonElement | null)?.click());
    await sleep(200);
    const afterRemove = await ctx.sidepanel.evaluate(() => ({
      removeBtns: document.querySelectorAll(".url-remove-btn").length,
    }));
    if (afterRemove.removeBtns !== afterPaste.removeBtns - 1) ctx.fail({ step: "remove URL", expected: `${afterPaste.removeBtns - 1} rows`, actual: String(afterRemove.removeBtns) });
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "crawl-config-panel");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
