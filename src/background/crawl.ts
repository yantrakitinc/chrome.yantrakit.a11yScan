/**
 * Site Crawl — depth-first traversal scanning (F03).
 */

import type { iMessage } from "@shared/messages";
import type { iCrawlOptions, iCrawlState, iCrawlAuth, iScanResult, iTestConfig } from "@shared/types";
import { getConfig } from "@shared/config";
import { setCrawlActive } from "./observer";
import { logError, logWarn } from "@shared/log";

const CRAWL_STORAGE_KEY = "crawlState";

let crawlState: iCrawlState = {
  status: "idle",
  startedAt: "",
  pagesVisited: 0,
  pagesTotal: 0,
  currentUrl: "",
  results: {},
  failed: {},
  queue: [],
  visited: [],
};

let crawlOptions: iCrawlOptions | null = null;
let crawlTestConfig: iTestConfig | null = null;
let shouldPause = false;
let shouldCancel = false;

/* ═══════════════════════════════════════════════════════════════════
   Message Handler
   ═══════════════════════════════════════════════════════════════════ */

export async function handleCrawlMessage(
  msg: iMessage,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  switch (msg.type) {
    case "START_CRAWL": {
      const crawlPayload = (msg as { payload: iCrawlOptions & { testConfig?: iTestConfig } }).payload;
      const { testConfig: tc, ...opts } = crawlPayload;
      crawlOptions = opts;
      crawlTestConfig = tc ?? null;
      shouldPause = false;
      shouldCancel = false;
      startCrawl(crawlOptions);
      sendResponse({ success: true });
      break;
    }

    case "PAUSE_CRAWL":
      shouldPause = true;
      crawlState.status = "paused";
      setCrawlActive(false);
      broadcastState();
      sendResponse({ success: true });
      break;

    case "RESUME_CRAWL":
      shouldPause = false;
      crawlState.status = "crawling";
      setCrawlActive(true);
      broadcastState();
      resumeCrawl();
      sendResponse({ success: true });
      break;

    case "CANCEL_CRAWL":
      shouldCancel = true;
      crawlState.status = "idle";
      setCrawlActive(false);
      broadcastState();
      await chrome.storage.local.remove(CRAWL_STORAGE_KEY);
      sendResponse({ success: true });
      break;

    case "GET_CRAWL_STATE":
      sendResponse({ type: "CRAWL_PROGRESS", payload: crawlState });
      break;

    case "USER_CONTINUE":
      shouldPause = false;
      crawlState.status = "crawling";
      broadcastState();
      resumeCrawl();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ error: "Unknown crawl message" });
  }
}

/* ═══════════════════════════════════════════════════════════════════
   Crawl Engine
   ═══════════════════════════════════════════════════════════════════ */

async function startCrawl(options: iCrawlOptions): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return;

  const startUrl = stripFragment(tab.url);
  const normalizedList = options.mode === "urllist" ? options.urlList.map(stripFragment) : null;

  crawlState = {
    status: "crawling",
    startedAt: new Date().toISOString(),
    pagesVisited: 0,
    pagesTotal: normalizedList ? normalizedList.length : 0,
    currentUrl: startUrl,
    results: {},
    failed: {},
    queue: normalizedList ?? [startUrl],
    visited: [],
  };

  setCrawlActive(true);
  broadcastState();
  await saveCrawlState();

  // Pre-crawl authentication (F03 Auth)
  if (options.auth) {
    try {
      await performAuth(options.auth, tab.id!);
    } catch (err) {
      logError("crawl.startCrawl", `auth failed at ${options.auth.loginUrl}`, err);
      crawlState.status = "complete";
      crawlState.failed["auth"] = `Login failed: ${String(err)}`;
      setCrawlActive(false);
      broadcastState();
      return;
    }
  }

  await processCrawlQueue();
}

async function performAuth(auth: iCrawlAuth, tabId: number): Promise<void> {
  // Navigate to login page
  await chrome.tabs.update(tabId, { url: auth.loginUrl });
  await waitForPageLoad(tabId, crawlOptions?.timeout || 30000);

  // Inject content script and fill credentials
  await chrome.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
  await chrome.scripting.executeScript({
    target: { tabId },
    func: (usernameSelector: string, passwordSelector: string, submitSelector: string, username: string, password: string) => {
      const usernameEl = document.querySelector(usernameSelector) as HTMLInputElement | null;
      const passwordEl = document.querySelector(passwordSelector) as HTMLInputElement | null;
      const submitEl = document.querySelector(submitSelector) as HTMLElement | null;
      if (!usernameEl) throw new Error(`Username field not found: ${usernameSelector}`);
      if (!passwordEl) throw new Error(`Password field not found: ${passwordSelector}`);
      if (!submitEl) throw new Error(`Submit button not found: ${submitSelector}`);
      usernameEl.value = username;
      usernameEl.dispatchEvent(new Event("input", { bubbles: true }));
      passwordEl.value = password;
      passwordEl.dispatchEvent(new Event("input", { bubbles: true }));
      submitEl.click();
    },
    args: [auth.usernameSelector, auth.passwordSelector, auth.submitSelector, auth.username, auth.password],
  });

  // Wait for post-login navigation to complete
  await waitForPageLoad(tabId, crawlOptions?.timeout || 30000);
}

async function resumeCrawl(): Promise<void> {
  setCrawlActive(true);
  await processCrawlQueue();
}

/** True when a URL matches any pattern in the gatedUrls config — used to tag scan results as auth-required. */
export function isUrlGated(url: string, gatedUrls?: { mode: string; patterns: string[] }): boolean {
  if (!gatedUrls || gatedUrls.mode === "none" || !gatedUrls.patterns?.length) return false;
  switch (gatedUrls.mode) {
    case "list": return gatedUrls.patterns.some((p) => url === p);
    case "prefix": return gatedUrls.patterns.some((p) => url.startsWith(p));
    case "regex": return gatedUrls.patterns.some((p) => {
      try { return new RegExp(p).test(url); }
      catch (err) {
        // Invalid regex from user-provided gatedUrls config — log a warning
        // so the user can fix the testConfig instead of silently treating
        // the URL as un-gated.
        logWarn("crawl.isUrlGated", `invalid regex pattern in gatedUrls: ${p}`, err);
        return false;
      }
    });
    default: return false;
  }
}

/**
 * Strip the fragment from a URL so `/page#a` and `/page#b` collapse to the
 * same crawl target. Returns the input unchanged on parse failure.
 */
export function stripFragment(url: string): string {
  try {
    const u = new URL(url);
    u.hash = "";
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Find the page rule (if any) that matches a URL. Each rule's `pattern` is
 * tried as a regex first; if compilation fails, falls back to substring
 * match. Returns the first matching rule or null.
 *
 * Pure; exported for tests. Used by the crawl engine to decide when to
 * pause and wait for user action (login, interaction, deferred-content).
 */
export function matchPageRule(
  url: string,
  pageRules: { pattern: string; waitType: string; description: string }[] | undefined,
): { pattern: string; waitType: string; description: string } | null {
  if (!pageRules || pageRules.length === 0) return null;
  for (const rule of pageRules) {
    let matched = false;
    try {
      matched = new RegExp(rule.pattern).test(url) || url.includes(rule.pattern);
    } catch (err) {
      // Invalid regex — fall back to substring match so the rule still works
      // for the common case of "just type the path" patterns. Warn so the
      // user can fix the regex if they intended one.
      logWarn("crawl.matchPageRule", `invalid regex pattern '${rule.pattern}' — falling back to substring match`, err);
      matched = url.includes(rule.pattern);
    }
    if (matched) return rule;
  }
  return null;
}

/**
 * Push newly-collected links into the crawl queue, skipping any URL that's
 * already visited or already enqueued. Returns a new queue array (does
 * not mutate the input). The reversal preserves depth-first order: the
 * first link on the page should pop first, but the queue is a LIFO stack.
 *
 * Pure; exported for tests.
 */
export function pushLinksToQueue(
  queue: string[],
  visited: string[],
  links: string[],
): string[] {
  const out = [...queue];
  for (const link of [...links].reverse()) {
    if (!visited.includes(link) && !out.includes(link)) {
      out.push(link);
    }
  }
  return out;
}

/**
 * Apply testConfig wcag + rules overrides on top of a base remote config.
 * Pure; exported for tests. Mutates a shallow clone of `config.rules` —
 * the input is not modified.
 *
 * Source of truth: R-CONFIG. include and exclude are mutually exclusive
 * by validator-time enforcement; this function applies whichever is set.
 */
export function applyTestConfigOverrides(
  config: { wcagVersion?: string; wcagLevel?: string; rules?: Record<string, { enabled: boolean }> },
  testConfig: iTestConfig | null,
): { wcagVersion?: string; wcagLevel?: string; rules?: Record<string, { enabled: boolean }> } {
  const out = { ...config, rules: { ...(config.rules || {}) } };
  if (testConfig?.wcag?.version) out.wcagVersion = testConfig.wcag.version;
  if (testConfig?.wcag?.level) out.wcagLevel = testConfig.wcag.level;
  if (testConfig?.rules?.include) {
    const overrideRules: Record<string, { enabled: boolean }> = {};
    for (const id of Object.keys(out.rules)) overrideRules[id] = { enabled: false };
    for (const id of testConfig.rules.include) overrideRules[id] = { enabled: true };
    out.rules = overrideRules;
  } else if (testConfig?.rules?.exclude) {
    const overrideRules = { ...out.rules };
    for (const id of testConfig.rules.exclude) overrideRules[id] = { enabled: false };
    out.rules = overrideRules;
  }
  return out;
}

async function processCrawlQueue(): Promise<void> {
  while (crawlState.queue.length > 0) {
    if (shouldCancel) return;

    if (shouldPause) {
      crawlState.status = "paused";
      setCrawlActive(false);
      broadcastState();
      return;
    }

    const url = crawlState.queue.pop()! // depth-first: LIFO stack;
    if (crawlState.visited.includes(url)) continue;

    // Tag gated URLs for auth awareness
    const isGated = isUrlGated(url, crawlOptions?.auth?.gatedUrls);

    // Check page rules
    const matchedRule = matchPageRule(url, crawlOptions?.pageRules);
    if (matchedRule) {
      crawlState.currentUrl = url;
      crawlState.status = "wait";
      broadcastState();
      chrome.runtime.sendMessage({
        type: "CRAWL_WAITING_FOR_USER",
        payload: { url, waitType: matchedRule.waitType, description: matchedRule.description },
      });
      shouldPause = true;
      return; // wait for USER_CONTINUE
    }

    // Navigate and scan
    crawlState.currentUrl = url;
    crawlState.status = "crawling";
    broadcastState();

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) continue;

      await chrome.tabs.update(tab.id, { url });
      await waitForPageLoad(tab.id, crawlOptions?.timeout || 30000);

      // Inject and scan
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["content.js"] });
      const baseConfig = await getConfig();
      const config = applyTestConfigOverrides(baseConfig, crawlTestConfig) as typeof baseConfig;

      // Activate mocks before scanning if testConfig has mocks
      if (crawlTestConfig?.mocks && crawlTestConfig.mocks.length > 0) {
        try {
          await chrome.tabs.sendMessage(tab.id, { type: "ACTIVATE_MOCKS", payload: { mocks: crawlTestConfig.mocks } });
        } catch (err) {
          // Content script not ready yet (race after page navigation). The
          // RUN_SCAN call below will inject + retry; mocks may not be applied
          // for this single page if they were defined. Warn so the user
          // knows their testConfig.mocks didn't take effect on `url`.
          logWarn("crawl.processCrawlQueue", `ACTIVATE_MOCKS failed before scan of ${url}`, err);
        }
      }

      const result = await chrome.tabs.sendMessage(tab.id, { type: "RUN_SCAN", payload: { config, isCrawl: true } });

      if (result?.type === "SCAN_RESULT") {
        const scanResult = result.payload as iScanResult;
        if (isGated) (scanResult as unknown as Record<string, unknown>).authRequired = true;
        crawlState.results[url] = scanResult;
        crawlState.visited.push(url);
        crawlState.pagesVisited++;

        // In Follow mode, collect links from the page
        if (crawlOptions?.mode === "follow") {
          const links = await collectLinks(tab.id, crawlOptions.scope || new URL(url).origin);
          crawlState.queue = pushLinksToQueue(crawlState.queue, crawlState.visited, links);
        }
      } else {
        crawlState.failed[url] = result?.payload?.message || "Scan failed";
        crawlState.visited.push(url);
        crawlState.pagesVisited++;
      }

      broadcastState();
      await saveCrawlState();

      // Movie mode delay between pages (F06-AC9)
      const movieStorage = await chrome.storage.local.get(["movie_enabled"]);
      if (movieStorage.movie_enabled && tab?.id) {
        await chrome.tabs.sendMessage(tab.id, { type: "START_MOVIE_MODE" });
        await sleep(5000);
        await chrome.tabs.sendMessage(tab.id, { type: "STOP_MOVIE_MODE" });
      }

      // Delay between pages
      if (crawlOptions?.delay) {
        await sleep(crawlOptions.delay);
      }
    } catch (err) {
      logError("crawl.processCrawlQueue", `page failed: ${url}`, err);
      crawlState.failed[url] = String(err);
      crawlState.visited.push(url);
      crawlState.pagesVisited++;
      broadcastState();
    }
  }

  // Crawl complete
  crawlState.status = "complete";
  setCrawlActive(false);
  broadcastState();
  await saveCrawlState();
}

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function broadcastState(): void {
  chrome.runtime.sendMessage({ type: "CRAWL_PROGRESS", payload: crawlState });
}

async function saveCrawlState(): Promise<void> {
  await chrome.storage.local.set({ [CRAWL_STORAGE_KEY]: crawlState });
}

function waitForPageLoad(tabId: number, timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Page load timeout"));
    }, timeout);

    function listener(id: number, info: { status?: string }): void {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 500); // Wait for DOM settling
      }
    }
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function collectLinks(tabId: number, scope: string): Promise<string[]> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (scopeUrl: string) => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const a of Array.from(document.querySelectorAll("a[href]"))) {
          if ((a as HTMLAnchorElement).rel?.split(/\s+/).includes("nofollow")) continue;
          const href = (a as HTMLAnchorElement).href;
          if (!href.startsWith(scopeUrl)) continue;
          // Strip fragment so /page#a and /page#b don't both queue.
          let normalized = href;
          try { const u = new URL(href); u.hash = ""; normalized = u.toString(); } catch { /* keep raw */ }
          if (seen.has(normalized)) continue;
          seen.add(normalized);
          out.push(normalized);
        }
        return out;
      },
      args: [scope],
    });
    return result?.result || [];
  } catch (err) {
    // Most likely cause: page closed or navigated away mid-collection. The
    // crawl recovers by treating the page as having no outgoing links, but
    // log so a user reporting "Follow mode missed pages" can diagnose.
    logWarn("crawl.collectLinks", `failed to collect links from tab ${tabId}`, err);
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
