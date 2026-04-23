/**
 * E2E test helpers — launch Chromium with the extension loaded.
 */

import puppeteer, { type Browser, type Page } from "puppeteer";
import path from "path";

const EXTENSION_PATH = path.resolve(__dirname, "../dist");
const DEMO_BASE = "https://a11yscan.yantrakit.com/demo";

export { DEMO_BASE };

/** Launch Chrome with the extension and return browser + sidepanel page */
export async function launchWithExtension(): Promise<{ browser: Browser; sidepanel: Page; extensionId: string }> {
  const browser = await puppeteer.launch({
    headless: false, // Extensions require non-headless
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  // Wait for service worker to register and get extension ID
  const swTarget = await browser.waitForTarget(
    (t) => t.type() === "service_worker" && t.url().includes("chrome-extension://"),
    { timeout: 10000 }
  );
  const extensionId = new URL(swTarget.url()).hostname;

  // Open the sidepanel as a regular page
  const sidepanel = await browser.newPage();
  await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });

  return { browser, sidepanel, extensionId };
}

/** Navigate the first non-extension tab to a URL and keep it focused */
export async function navigateTo(browser: Browser, url: string): Promise<Page> {
  const pages = await browser.pages();
  const page = pages.find((p) => !p.url().includes("chrome-extension://") && !p.url().startsWith("about:")) || pages[0];
  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
  // Keep this tab focused so chrome.tabs.query({active:true}) finds it
  await page.bringToFront();
  return page;
}

/** Click a button by its ID in the sidepanel (without changing tab focus) */
export async function clickById(sidepanel: Page, id: string): Promise<void> {
  await sidepanel.waitForSelector(`#${id}`, { timeout: 5000 });
  await sidepanel.evaluate((elId) => {
    const el = document.getElementById(elId);
    if (el) el.click();
    else throw new Error(`Element #${elId} not found`);
  }, id);
}

/** Click a button by text content in the sidepanel */
export async function clickByText(sidepanel: Page, text: string): Promise<void> {
  await sidepanel.evaluate((t) => {
    const btns = Array.from(document.querySelectorAll("button"));
    const btn = btns.find((b) => b.textContent?.trim() === t);
    if (btn) btn.click();
    else throw new Error(`Button with text "${t}" not found`);
  }, text);
}

/** Get text content of an element by selector */
export async function getText(sidepanel: Page, selector: string): Promise<string> {
  return sidepanel.$eval(selector, (el) => el.textContent?.trim() || "");
}

/** Wait for scan results to appear */
export async function waitForScanResults(sidepanel: Page): Promise<void> {
  await sidepanel.waitForFunction(
    () => document.querySelector("#scan-content")?.textContent?.includes("violation") ||
          document.querySelector("#scan-content")?.textContent?.includes("passes") ||
          document.querySelector("#scan-content")?.textContent?.includes("No violations"),
    { timeout: 30000 }
  );
}

/** Upload a test config JSON via the config modal */
export async function uploadConfig(sidepanel: Page, config: Record<string, unknown>): Promise<void> {
  // Expand accordion if collapsed
  await sidepanel.evaluate(() => {
    const body = document.querySelector(".accordion-body");
    if (body?.classList.contains("collapsed")) {
      const toggle = document.querySelector(".accordion-toggle") as HTMLElement;
      if (toggle) toggle.click();
    }
  });
  await new Promise((r) => setTimeout(r, 300));

  // Open config modal
  await clickById(sidepanel, "settings-btn");
  await sidepanel.waitForSelector("#config-dialog[open]", { timeout: 3000 });

  // Set config JSON into textarea via JS (no focus change)
  await sidepanel.evaluate((json) => {
    const textarea = document.getElementById("config-textarea") as HTMLTextAreaElement;
    if (textarea) textarea.value = json;
  }, JSON.stringify(config));

  // Click Apply
  await clickById(sidepanel, "config-apply-btn");

  // Wait for dialog to close
  await sidepanel.waitForFunction(
    () => !document.querySelector("#config-dialog[open]"),
    { timeout: 3000 }
  );
}

/** Get the count of violations from results */
export async function getViolationCount(sidepanel: Page): Promise<number> {
  return sidepanel.evaluate(() => {
    const details = document.querySelectorAll("#scan-content details");
    return details.length;
  });
}
