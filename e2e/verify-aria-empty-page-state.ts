/**
 * Verification: ARIA tab on a page with ZERO ARIA widgets.
 *
 * Hypothesis: when a page has no ARIA widgets, after Scan Page completes the
 * ARIA tab still shows "No ARIA widgets scanned yet" + "Scan ARIA Patterns"
 * button — same UI as BEFORE any scan. The user reads this as "you didn't
 * scan" because the text says "yet" and the button says "Scan ARIA Patterns".
 *
 * After-scan state should distinguish from before-scan state. Even if the
 * widgets array is empty, the user has scanned and should see "no ARIA
 * widgets detected on this page" — not the manual-scan button.
 *
 * Usage:
 *   pnpm build && npx tsx e2e/verify-aria-empty-page-state.ts
 */

import path from "path";
import http from "http";
import type { AddressInfo } from "net";
import puppeteer, { type Browser, type Page } from "puppeteer";

const EXTENSION_PATH = path.resolve(__dirname, "../dist");

// Fixture: a simple page with NO ARIA widgets (just a heading + paragraph)
const NO_ARIA_HTML = `
<!doctype html>
<html lang="en">
<head><title>No ARIA fixture</title></head>
<body>
  <h1>Plain page — no ARIA widgets</h1>
  <p>Just a heading and a paragraph. No ARIA roles anywhere.</p>
  <a href="#anchor">A simple link</a>
</body>
</html>
`;

interface iVerifyFailure {
  step: string;
  expected: string;
  actual: string;
}

async function run(): Promise<void> {
  const failures: iVerifyFailure[] = [];

  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(NO_ARIA_HTML);
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
    const swTarget = await browser.waitForTarget(
      (t) => t.type() === "service_worker" && t.url().includes("chrome-extension://"),
      { timeout: 10000 },
    );
    const extensionId = new URL(swTarget.url()).hostname;

    const page: Page = await browser.newPage();
    await page.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
    await page.bringToFront();

    const sidepanel: Page = await browser.newPage();
    await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });
    await page.bringToFront();
    await new Promise((r) => setTimeout(r, 300));

    // Click Scan Page — keep fixture tab focused so chrome.tabs.query({active:true}) finds it
    await sidepanel.waitForSelector("#scan-btn", { timeout: 5000 });
    await sidepanel.evaluate(() => (document.getElementById("scan-btn") as HTMLButtonElement).click());
    try {
      await sidepanel.waitForSelector('[data-subtab="aria"]', { timeout: 30000 });
    } catch {
      const debug = await sidepanel.evaluate(() => ({
        bodyText: document.body.textContent?.substring(0, 800) || "",
      }));
      console.error("DEBUG body after scan:", debug.bodyText);
      failures.push({ step: "wait-for-results", expected: "scanPhase=results", actual: "timeout (see DEBUG above)" });
      throw new Error("scan-timeout");
    }

    await new Promise((r) => setTimeout(r, 2000));

    // Switch to ARIA sub-tab via JS click (no OS focus change needed)
    await sidepanel.evaluate(() => {
      const tab = document.querySelector('[data-subtab="aria"]') as HTMLButtonElement | null;
      if (tab) tab.click();
    });
    await new Promise((r) => setTimeout(r, 300));

    const afterScan = await sidepanel.evaluate(() => {
      const html = document.querySelector("#scan-content")?.innerHTML || "";
      return {
        hasManualScanButton: !!document.getElementById("run-aria-scan"),
        emptyStateText: html.includes("No ARIA widgets scanned yet"),
        scanContentLength: html.length,
        ariaTabBodyText: document.querySelector("#scan-content")?.textContent?.trim() || "",
      };
    });
    console.log("AFTER scan:", afterScan);

    // Take screenshot
    await sidepanel.screenshot({ path: path.resolve(__dirname, "../verify-aria-empty-page-screenshot.png"), fullPage: true });

    // ASSERTION: After a scan completes, the ARIA tab MUST NOT show the
    // pre-scan empty state. The text "No ARIA widgets scanned yet" is
    // ambiguous — it implies the user hasn't scanned. After Scan Page,
    // we want a different message (e.g., "Page has no ARIA widgets").
    if (afterScan.emptyStateText) {
      failures.push({
        step: "after-scan-empty-state-still-says-scanned-yet",
        expected: "ARIA tab text differs from pre-scan empty state (no 'scanned yet' phrasing, no 'Scan ARIA Patterns' button)",
        actual: `ARIA tab text: "${afterScan.ariaTabBodyText}"`,
      });
    }
    if (afterScan.hasManualScanButton) {
      failures.push({
        step: "after-scan-manual-button-still-present",
        expected: "no 'Scan ARIA Patterns' button after Scan Page completes (scan already happened)",
        actual: "Scan ARIA Patterns button is present",
      });
    }
  } finally {
    await browser.close();
    server.close();
  }

  if (failures.length > 0) {
    console.error("\n=== VERIFY FAILED — confirms hypothesis ===");
    for (const f of failures) {
      console.error(`\nstep:     ${f.step}`);
      console.error(`expected: ${f.expected}`);
      console.error(`actual:   ${f.actual}`);
    }
    process.exit(1);
  }

  console.log("=== VERIFY PASSED ===");
  process.exit(0);
}

run().catch((err) => {
  console.error("UNCAUGHT:", err);
  process.exit(2);
});
