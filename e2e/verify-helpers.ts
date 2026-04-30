/**
 * Shared helpers for verify-*.ts scripts.
 *
 * Each verify script:
 *  - launches Puppeteer with the unpacked extension
 *  - optionally serves a fixture HTML page from a local HTTP server
 *  - opens the side panel as a regular tab (chrome-extension://<id>/sidepanel.html)
 *  - exercises the path
 *  - asserts via DOM + getComputedStyle + captured chrome.runtime messages
 *  - prints PASS/FAIL with structured failure output
 */

import path from "path";
import http from "http";
import type { AddressInfo } from "net";
import puppeteer, { type Browser, type Page } from "puppeteer";

const EXTENSION_PATH = path.resolve(__dirname, "../dist");

export interface iVerifyFailure {
  step: string;
  expected: string;
  actual: string;
}

export interface iVerifyContext {
  browser: Browser;
  sidepanel: Page;
  page: Page;
  fixtureUrl: string;
  consoleLogs: string[];
  /** Call to add a failure; the runner will print + exit nonzero at the end. */
  fail: (f: iVerifyFailure) => void;
  failures: iVerifyFailure[];
}

/** Launch Puppeteer + serve fixture HTML + open side panel. */
export async function setup(fixtureHtml: string): Promise<{
  ctx: iVerifyContext;
  cleanup: () => Promise<void>;
}> {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(fixtureHtml);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const fixtureUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

  const browser = await puppeteer.launch({
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  const swTarget = await browser.waitForTarget(
    (t) => t.type() === "service_worker" && t.url().includes("chrome-extension://"),
    { timeout: 10000 },
  );
  const extensionId = new URL(swTarget.url()).hostname;

  const consoleLogs: string[] = [];

  const page = await browser.newPage();
  page.on("console", (m) => consoleLogs.push(`[page ${m.type()}] ${m.text()}`));
  await page.goto(fixtureUrl, { waitUntil: "domcontentloaded" });
  await page.bringToFront();

  const sidepanel = await browser.newPage();
  sidepanel.on("console", (m) => consoleLogs.push(`[sidepanel ${m.type()}] ${m.text()}`));
  await sidepanel.goto(`chrome-extension://${extensionId}/sidepanel.html`, { waitUntil: "domcontentloaded" });

  // Refocus fixture so chrome.tabs.query({active:true}) finds it
  await page.bringToFront();
  await sleep(300);

  const failures: iVerifyFailure[] = [];

  return {
    ctx: {
      browser,
      sidepanel,
      page,
      fixtureUrl,
      consoleLogs,
      failures,
      fail: (f) => failures.push(f),
    },
    cleanup: async () => {
      await browser.close();
      server.close();
    },
  };
}

/** Click a button by id in the sidepanel via JS (no OS focus change). */
export async function clickById(panel: Page, id: string): Promise<void> {
  await panel.waitForSelector(`#${id}`, { timeout: 5000 });
  await panel.evaluate((elId) => {
    const el = document.getElementById(elId);
    if (el) (el as HTMLElement).click();
    else throw new Error(`#${elId} not found`);
  }, id);
}

/** Sleep helper (Promise-based setTimeout). */
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Print failures + exit nonzero, or print PASS + exit 0. */
export function reportAndExit(ctx: iVerifyContext, scriptName: string): void {
  if (ctx.failures.length > 0) {
    console.error(`\n=== ${scriptName} VERIFY FAILED ===`);
    for (const f of ctx.failures) {
      console.error(`\nstep:     ${f.step}`);
      console.error(`expected: ${f.expected}`);
      console.error(`actual:   ${f.actual}`);
    }
    console.error(`\n=== Console logs (last 30) ===`);
    for (const l of ctx.consoleLogs.slice(-30)) console.error(l);
    process.exit(1);
  }
  console.log(`=== ${scriptName} VERIFY PASSED ===`);
  process.exit(0);
}
