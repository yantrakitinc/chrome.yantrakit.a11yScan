/**
 * Verification: ARIA tab populates automatically after Scan Page on a page
 * with known ARIA widgets.
 *
 * Bug context (issue #99): user reported that after Scan Page, the ARIA tab
 * shows "No ARIA widgets scanned yet" + "Scan ARIA Patterns" button instead of
 * the auto-scanned widgets. PR #100 added rerender() in the .then() callback
 * but was never verified in real Chrome — this script checks if that fix actually
 * works, OR identifies the actual root cause.
 *
 * Usage:
 *   pnpm build && npx tsx e2e/verify-aria-tab-populated-after-scan.ts
 *
 * Exit 0 = ARIA tab correctly populated after Scan Page.
 * Exit nonzero = bug present, with structured failure output to stdout.
 */

import path from "path";
import http from "http";
import type { AddressInfo } from "net";
import puppeteer, { type Browser, type Page } from "puppeteer";

const EXTENSION_PATH = path.resolve(__dirname, "../dist");

// Inline test page with known ARIA widgets — a tablist (3 tabs) + a dialog +
// a checkbox-grouped form. We control the page so we can assert the EXACT
// number of widgets the scanner should detect.
const FIXTURE_HTML = `
<!doctype html>
<html lang="en">
<head><title>ARIA fixture</title></head>
<body>
  <h1>ARIA fixture page</h1>

  <!-- Tablist with 3 tabs (passes most checks) -->
  <div role="tablist" id="tabs" aria-label="Settings tabs">
    <button role="tab" id="tab1" aria-selected="true" aria-controls="panel1">General</button>
    <button role="tab" id="tab2" aria-selected="false" aria-controls="panel2">Privacy</button>
    <button role="tab" id="tab3" aria-selected="false" aria-controls="panel3">Advanced</button>
  </div>
  <div role="tabpanel" id="panel1">General settings</div>
  <div role="tabpanel" id="panel2" hidden>Privacy settings</div>
  <div role="tabpanel" id="panel3" hidden>Advanced settings</div>

  <!-- Dialog with aria-label (FAILS has-aria-modal check — intentional) -->
  <div role="dialog" id="dlg" aria-label="Confirm">
    <p>Are you sure?</p>
    <button>OK</button>
    <button>Cancel</button>
  </div>

  <!-- Checkbox widget -->
  <div role="checkbox" aria-checked="false" tabindex="0">Accept terms</div>
</body>
</html>
`;

interface iVerifyFailure {
  step: string;
  expected: string;
  actual: string;
  consoleLogs?: string[];
}

async function run(): Promise<void> {
  const failures: iVerifyFailure[] = [];
  const consoleLogs: string[] = [];

  // Spin up a tiny HTTP server so the fixture has a real http:// origin
  // (Chrome restricts content-script injection on data:/file:/chrome:// URLs).
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(FIXTURE_HTML);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const fixtureUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  const browser: Browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  try {
    // Wait for service worker
    const swTarget = await browser.waitForTarget(
      (t) => t.type() === "service_worker" && t.url().includes("chrome-extension://"),
      { timeout: 10000 },
    );
    const extensionId = new URL(swTarget.url()).hostname;

    // Open the fixture page in a real tab. Use a data: URL so we don't need a
    // local web server.
    const page: Page = await browser.newPage();
    page.on("console", (m) => consoleLogs.push(`[page] ${m.type()}: ${m.text()}`));
    await page.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
    await page.bringToFront();

    // Open the side panel as a regular page (Puppeteer can't open a real
    // sidebar; we use the same HTML/JS as a normal tab — works for testing).
    const sidepanel: Page = await browser.newPage();
    sidepanel.on("console", (m) => consoleLogs.push(`[sidepanel] ${m.type()}: ${m.text()}`));
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
    // Refocus the fixture tab so chrome.tabs.query({active:true}) finds it
    await page.bringToFront();
    await new Promise((r) => setTimeout(r, 300));

    // Click Scan Page
    await sidepanel.waitForSelector("#scan-btn", { timeout: 5000 });
    consoleLogs.push(`[harness] About to click #scan-btn. fixtureUrl=${fixtureUrl}`);
    const allTabs = await browser.pages();
    consoleLogs.push(`[harness] tabs: ${allTabs.map((p) => p.url()).join(" | ")}`);
    await sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());

    // Wait for the scanPhase to flip to "results" — most reliable signal
    try {
      await sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 });
    } catch {
      const debug = await sidepanel.evaluate(() => ({
        bodyHtmlLength: document.body.innerHTML.length,
        scanContentText: document.querySelector("#scan-content")?.textContent?.substring(0, 500) || "",
        panelScanText: document.querySelector("#panel-scan")?.textContent?.substring(0, 800) || "",
      }));
      console.error("\n[harness] consoleLogs collected:");
      for (const l of consoleLogs) console.error("  " + l);
      console.error("\n[harness] scanContentText:", debug.scanContentText);
      failures.push({
        step: "wait-for-scan-results",
        expected: "scanPhase=results (sub-tabs render) within 30s",
        actual: `timeout. body length=${debug.bodyHtmlLength}; see DEBUG above`,
      });
      throw new Error("scan-results-timeout");
    }

    // Give the background ARIA scan time to round-trip + render
    await new Promise((r) => setTimeout(r, 2000));

    // Click the ARIA sub-tab
    await sidepanel.evaluate(() => {
      const tab = document.querySelector('[data-subtab="aria"]') as HTMLButtonElement | null;
      if (tab) tab.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    // Inspect the ARIA tab body
    const ariaTabState = await sidepanel.evaluate(() => {
      const content = document.querySelector("#scan-content");
      const html = content?.innerHTML || "";
      return {
        hasEmptyStateText: html.includes("No ARIA widgets scanned yet"),
        hasManualScanButton: !!document.getElementById("run-aria-scan"),
        hasDetailsElements: document.querySelectorAll("#scan-content details").length,
        hasTablistMention: html.includes("tablist"),
        hasDialogMention: html.toLowerCase().includes("dialog"),
        hasCheckboxMention: html.toLowerCase().includes("checkbox"),
      };
    });

    if (ariaTabState.hasEmptyStateText || ariaTabState.hasManualScanButton) {
      failures.push({
        step: "aria-tab-empty-state-after-scan",
        expected: "ARIA tab shows widgets (no empty-state text, no manual scan button)",
        actual: `empty-state-text=${ariaTabState.hasEmptyStateText} manual-scan-button=${ariaTabState.hasManualScanButton} details=${ariaTabState.hasDetailsElements}`,
      });
    }
    if (ariaTabState.hasDetailsElements < 3) {
      failures.push({
        step: "aria-widget-count",
        expected: "at least 3 ARIA widgets rendered as <details> (tablist + dialog + checkbox)",
        actual: `${ariaTabState.hasDetailsElements} <details> elements rendered`,
      });
    }
    if (!ariaTabState.hasTablistMention) {
      failures.push({
        step: "aria-tablist-detected",
        expected: "tablist mentioned in ARIA tab HTML",
        actual: "not found",
      });
    }

    // Take a screenshot for the PR
    await sidepanel.screenshot({ path: path.resolve(__dirname, "../verify-aria-after-scan-screenshot.png"), fullPage: true });
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length > 0) {
    console.error("\n=== VERIFY FAILED ===");
    for (const f of failures) {
      console.error(`\nstep:     ${f.step}`);
      console.error(`expected: ${f.expected}`);
      console.error(`actual:   ${f.actual}`);
    }
    console.error("\n=== Console logs (last 50) ===");
    for (const l of consoleLogs.slice(-50)) console.error(l);
    process.exit(1);
  }

  console.log("=== VERIFY PASSED ===");
  console.log("ARIA tab populated correctly after Scan Page.");
  process.exit(0);
}

run().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(2);
});
