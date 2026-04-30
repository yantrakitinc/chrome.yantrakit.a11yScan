/**
 * Verify: F14 mock API.
 * Inventory: docs/test-matrix/features/f14-mock-api.md
 *
 * KNOWN STRUCTURAL DEFECT — DOCUMENTED REGRESSION:
 * The current mock-interceptor (src/content/mock-interceptor.ts) patches
 * `window.fetch` and `XMLHttpRequest.prototype.open` from the content script's
 * isolated world. In real Chrome, content scripts do NOT share `window` with
 * the inspected page (they run in an isolated JavaScript context), so the
 * patch never affects the page's fetch. This makes F14 a unit-test-only
 * feature: the unit tests in `src/content/__tests__/mock-interceptor.test.ts`
 * pass under jsdom (single shared window), but in real Chrome the page's
 * fetch is never intercepted.
 *
 * This script verifies the round-trip end-to-end and SENTINEL-FAILS until F14
 * is reworked to inject the patch into the MAIN world via either
 * `chrome.scripting.executeScript({ world: "MAIN" })` or a script tag.
 */

import { setup, sleep, reportAndExit } from "./verify-helpers";

const FIXTURE_HTML = `<!doctype html><html><body><h1>F14 fixture</h1><script>
  window.__lastFetchBody = null;
  window.__doFetch = function(){
    return fetch('/api/users').then(function(r){return r.text();}).then(function(t){window.__lastFetchBody = t;});
  };
</script></body></html>`;

async function run(): Promise<void> {
  const { ctx, cleanup } = await setup(FIXTURE_HTML);
  try {
    // Inject content.js into the fixture tab first (manifest doesn't auto-inject
    // — content script is normally injected by background on SCAN_REQUEST).
    const activateOk = await ctx.sidepanel.evaluate(`(async function(){
      const tabs = await new Promise(function(res){ chrome.tabs.query({}, function(t){ res(t); }); });
      const tab = tabs.find(function(t){ return t.url && t.url.startsWith('http://127.0.0.1:'); });
      if (!tab) return { ok: false, reason: 'fixture tab not found among ' + tabs.length + ' tabs', urls: tabs.map(function(t){return t.url;}) };
      try {
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
      } catch (e) {
        // already injected — fine
      }
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'ACTIVATE_MOCKS',
          payload: { mocks: [{ url: '/api/users', body: { mocked: true, count: 7 } }] },
        });
        return { ok: true, tabId: tab.id };
      } catch (e) {
        return { ok: false, reason: String(e) };
      }
    })()`) as { ok: boolean; reason?: string; tabId?: number };

    if (!activateOk.ok) {
      console.error("ACTIVATE_MOCKS diagnostic:", JSON.stringify(activateOk));
      ctx.fail({ step: "ACTIVATE_MOCKS dispatch", expected: "tabs.sendMessage succeeds to fixture tab", actual: JSON.stringify(activateOk) });
    }

    if (!activateOk.ok) {
      // Skip the rest of the round-trip checks
      reportAndExit(ctx, "f14-mock-api");
      return;
    }

    // Switch to page tab + invoke the fetch
    await ctx.page.bringToFront();
    await sleep(200);
    const body = await ctx.page.evaluate(`(async function(){
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await window.__doFetch();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return window.__lastFetchBody;
    })()`) as string | null;

    if (!body) {
      ctx.fail({ step: "mock fetch", expected: "fetch returns mock body", actual: "null/empty" });
    } else if (!body.includes('"mocked"') || !body.includes("7")) {
      ctx.fail({ step: "mock fetch", expected: "body contains mock marker (mocked + 7)", actual: body.slice(0, 200) });
    }

    // DEACTIVATE_MOCKS → fetch should fall through (returns 404 from local server, but NOT the mock body)
    if (activateOk.tabId !== undefined) {
      const tabId = activateOk.tabId;
      await ctx.sidepanel.evaluate(`(async function(){
        await chrome.tabs.sendMessage(${tabId}, { type: 'DEACTIVATE_MOCKS' });
      })()`);
      await ctx.page.bringToFront();
      await sleep(200);
      const after = await ctx.page.evaluate(`(async function(){
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await window.__doFetch();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return window.__lastFetchBody;
      })()`) as string | null;
      if (after && after.includes('"mocked"')) {
        ctx.fail({ step: "DEACTIVATE_MOCKS", expected: "fetch falls through (no mock body)", actual: "still returning mock body — deactivate did not restore" });
      }
    }
  } finally {
    await cleanup();
  }
  reportAndExit(ctx, "f14-mock-api");
}

run().catch((err) => { console.error("UNCAUGHT:", err); process.exit(2); });
