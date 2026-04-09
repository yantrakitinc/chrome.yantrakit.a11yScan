/**
 * Site crawl: depth-first traversal with backtracking.
 *
 * Algorithm:
 * 1. Start on current page, collect all same-origin links (skip nofollow)
 * 2. Visit first unvisited link, scan it, collect its links
 * 3. Keep going deeper — first unvisited link from current page
 * 4. When a page has no unvisited links, backtrack to parent
 * 5. Continue until every reachable page is visited
 *
 * Resilience:
 * - Pages that fail to load (403, redirect, timeout) are skipped
 * - Redirects are detected (final URL != requested URL) and logged
 * - Auth-gated pages that redirect logged-in users are handled gracefully
 */

import type { iPageRule, iPageRuleWaitType, iMockEndpoint } from '@shared/test-config';

export interface iCrawlOptions {
  mode: 'discover' | 'sitemap';
  maxPages: number;
  sitemapUrl?: string;
  pageRules?: iPageRule[];
  mocks?: iMockEndpoint[];
  pageLoadTimeout?: number;
  scanTimeout?: number;
  delayBetweenPages?: number;
  crawlScope?: string;
}

export interface iCrawlPageResult {
  url: string;
  status: 'scanned' | 'failed' | 'skipped' | 'redirected';
  violations: any[];
  passes: number;
  incomplete: number;
  error?: string;
  redirectedTo?: string;
  depth: number;
}

export interface iCrawlState {
  status: 'idle' | 'crawling' | 'paused' | 'complete';
  origin: string;
  visited: string[];
  completed: string[];
  failed: string[];
  results: iCrawlPageResult[];
  maxPages: number;
  startedAt: string;
  current?: string;
  depth: number;
  totalDiscovered: number;
}

let crawlState: iCrawlState = {
  status: 'idle', origin: '', visited: [], completed: [], failed: [],
  results: [], maxPages: 0, startedAt: '', depth: 0, totalDiscovered: 0,
};

let crawlTabId: number | null = null;
let crawlCancelled = false;
let crawlPaused = false;
let crawlResolveResume: (() => void) | null = null;
let crawlPageRules: iPageRule[] = [];
let crawlMocks: iMockEndpoint[] = [];
let crawlPageLoadTimeout = 15000;
let crawlScanTimeout = 0;
let crawlDelayBetweenPages = 300;
let crawlScope = '';
let waitingForUser = false;
let resolveUserContinue: (() => void) | null = null;
/** Recorded page rules during crawl (for smart config generation). */
let recordedPageRules: iPageRule[] = [];

/** Waits if the crawl is paused. Resolves when resumed or cancelled. */
async function waitIfPaused(): Promise<void> {
  if (!crawlPaused) return;
  await new Promise<void>((resolve) => {
    crawlResolveResume = resolve;
  });
  crawlResolveResume = null;
}

/** Checks if a URL matches any page rule. Returns the matching rule or null. */
function matchPageRule(url: string): iPageRule | null {
  for (const rule of crawlPageRules) {
    try {
      if (url.includes(rule.urlPattern) || new RegExp(rule.urlPattern).test(url)) {
        return rule;
      }
    } catch {
      if (url.includes(rule.urlPattern)) return rule;
    }
  }
  return null;
}

/** Pauses the crawl and waits for the user to click Continue. */
async function waitForUserContinue(url: string, waitType: iPageRuleWaitType, description?: string): Promise<void> {
  waitingForUser = true;
  chrome.runtime.sendMessage({
    type: 'CRAWL_WAITING_FOR_USER',
    waitType,
    url,
    description,
  }).catch(() => {});

  await new Promise<void>((resolve) => {
    resolveUserContinue = resolve;
  });
  resolveUserContinue = null;
  waitingForUser = false;
}

/** Called when user clicks Continue in the side panel. */
export function userContinue(): void {
  if (resolveUserContinue) resolveUserContinue();
}

/** Records a manual pause as a page rule for smart config generation. */
export function recordManualPause(url: string, waitType: iPageRuleWaitType, description?: string): void {
  recordedPageRules.push({ urlPattern: new URL(url).pathname, waitType, description });
}

/** Returns recorded page rules for config generation. */
export function getRecordedPageRules(): iPageRule[] {
  return [...recordedPageRules];
}

function sendProgress() {
  chrome.runtime.sendMessage({
    type: 'CRAWL_PROGRESS',
    state: { ...crawlState },
  }).catch(() => {});
}

async function fetchSitemapUrls(sitemapUrl: string): Promise<string[]> {
  try {
    const res = await fetch(sitemapUrl);
    const text = await res.text();
    const urls: string[] = [];
    const locRegex = /<loc>(.*?)<\/loc>/g;
    let match;
    while ((match = locRegex.exec(text)) !== null) {
      urls.push(match[1]);
    }
    const sitemapRegex = /<sitemap>.*?<loc>(.*?)<\/loc>.*?<\/sitemap>/gs;
    while ((match = sitemapRegex.exec(text)) !== null) {
      const childUrls = await fetchSitemapUrls(match[1]);
      urls.push(...childUrls);
    }
    return urls;
  } catch {
    return [];
  }
}

/** Navigates a tab and waits for load. Returns the final URL (may differ if redirected). */
async function navigateAndWait(tabId: number, url: string, timeout = 15000): Promise<string> {
  await chrome.tabs.update(tabId, { url });
  return new Promise<string>((resolve) => {
    let resolved = false;
    const listener = (tid: number, info: { status?: string }, tab: chrome.tabs.Tab) => {
      if (tid === tabId && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        if (!resolved) {
          resolved = true;
          resolve(tab.url || url);
        }
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      if (!resolved) {
        resolved = true;
        resolve(url);
      }
    }, timeout);
  });
}

/** Discovers links on a page, filtering by crawlScope (or origin). Skips nofollow. */
async function discoverLinks(tabId: number, origin: string): Promise<string[]> {
  // Use crawlScope if set, otherwise fall back to origin.
  // Ensure the scope prefix ends with '/' to prevent /creator matching /creators.
  let scopePrefix = crawlScope || origin;
  if (scopePrefix && !scopePrefix.endsWith('/')) {
    scopePrefix += '/';
  }
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (prefix: string) => {
        return Array.from(document.querySelectorAll('a[href]'))
          .filter((a) => {
            const rel = a.getAttribute('rel') || '';
            return !rel.includes('nofollow');
          })
          .map((a) => {
            try {
              const href = (a as HTMLAnchorElement).href;
              const parsed = new URL(href);
              parsed.hash = '';
              return parsed.href;
            } catch { return ''; }
          })
          .filter((href) => href !== '' && (href.startsWith(prefix) || href === prefix.replace(/\/$/, '')));
      },
      args: [scopePrefix],
    });
    return [...new Set(result?.result || [])];
  } catch {
    return [];
  }
}

/** Scans a single page. Handles failures, redirects, and page rules. */
async function scanPage(tabId: number, url: string, origin: string, depth: number): Promise<{ result: iCrawlPageResult; links: string[] }> {
  try {
    const finalUrl = await navigateAndWait(tabId, url, crawlPageLoadTimeout);

    const redirected = finalUrl !== url && !finalUrl.startsWith(url + '#');
    if (redirected && !finalUrl.startsWith(origin)) {
      return {
        result: { url, status: 'redirected', violations: [], passes: 0, incomplete: 0, redirectedTo: finalUrl, depth },
        links: [],
      };
    }

    // Check page rules — pause if URL matches a rule
    const rule = matchPageRule(finalUrl);
    if (rule) {
      await waitForUserContinue(finalUrl, rule.waitType, rule.description);
    }

    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });

    // Inject mocks before scanning if configured
    if (crawlMocks.length > 0) {
      await chrome.tabs.sendMessage(tabId, { type: 'ACTIVATE_MOCKS', mocks: crawlMocks });
      await new Promise((r) => setTimeout(r, 500)); // Wait for mocked data to load
    } else {
      await new Promise((r) => setTimeout(r, crawlDelayBetweenPages));
    }

    const response = await chrome.tabs.sendMessage(tabId, { type: 'RUN_SCAN', scanTimeout: crawlScanTimeout });
    const links = await discoverLinks(tabId, origin);

    return {
      result: {
        url: redirected ? finalUrl : url,
        status: 'scanned',
        violations: response?.violations || [],
        passes: (response?.passes || []).length,
        incomplete: (response?.incomplete || []).length,
        redirectedTo: redirected ? finalUrl : undefined,
        depth,
      },
      links,
    };
  } catch (err) {
    return {
      result: { url, status: 'failed', violations: [], passes: 0, incomplete: 0, error: String(err), depth },
      links: [],
    };
  }
}

async function depthFirstCrawl(tabId: number, startUrls: string[], origin: string, maxPages: number): Promise<void> {
  const visited = new Set<string>();
  const unlimited = maxPages === 0;
  const stack: { url: string; children: string[] }[] = [];

  for (const url of startUrls) {
    if (crawlCancelled) return;
    await waitIfPaused();
    if (crawlCancelled) return;
    if (visited.has(url)) continue;
    if (!unlimited && visited.size >= maxPages) break;

    visited.add(url);
    crawlState.current = url;
    crawlState.depth = stack.length;
    sendProgress();

    const { result, links } = await scanPage(tabId, url, origin, stack.length);
    crawlState.results.push(result);

    if (result.status === 'scanned') {
      crawlState.completed.push(url);
    } else {
      crawlState.failed.push(url);
    }
    crawlState.visited = Array.from(visited);

    const unvisited = links.filter((l) => !visited.has(l));
    crawlState.totalDiscovered += unvisited.length;
    sendProgress();

    if (unvisited.length > 0) {
      stack.push({ url, children: unvisited });

      while (stack.length > 0 && !crawlCancelled) {
        const top = stack[stack.length - 1];

        if (top.children.length === 0) {
          stack.pop();
          continue;
        }

        await waitIfPaused();
        if (crawlCancelled) break;

        const nextUrl = top.children.shift()!;
        if (visited.has(nextUrl)) continue;
        if (!unlimited && visited.size >= maxPages) break;

        visited.add(nextUrl);
        crawlState.current = nextUrl;
        crawlState.depth = stack.length;
        sendProgress();

        const childResult = await scanPage(tabId, nextUrl, origin, stack.length);
        crawlState.results.push(childResult.result);

        if (childResult.result.status === 'scanned') {
          crawlState.completed.push(nextUrl);
        } else {
          crawlState.failed.push(nextUrl);
        }
        crawlState.visited = Array.from(visited);

        const childUnvisited = childResult.links.filter((l) => !visited.has(l));
        crawlState.totalDiscovered += childUnvisited.length;
        sendProgress();

        if (childUnvisited.length > 0) {
          stack.push({ url: nextUrl, children: childUnvisited });
        }
      }
    }
  }
}

export async function startCrawl(options: iCrawlOptions): Promise<iCrawlState> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url || !tab.id) throw new Error('No active tab');

  crawlTabId = tab.id;
  crawlCancelled = false;
  crawlPaused = false;
  crawlPageRules = options.pageRules || [];
  crawlMocks = options.mocks || [];
  crawlPageLoadTimeout = options.pageLoadTimeout || 15000;
  crawlScanTimeout = options.scanTimeout || 0;
  crawlDelayBetweenPages = options.delayBetweenPages || 300;
  crawlScope = options.crawlScope || '';
  recordedPageRules = [];
  const origin = new URL(tab.url).origin;

  let startUrls: string[];
  if (options.mode === 'sitemap' && options.sitemapUrl) {
    startUrls = await fetchSitemapUrls(options.sitemapUrl);
  } else {
    startUrls = [tab.url];
  }

  crawlState = {
    status: 'crawling', origin, visited: [], completed: [], failed: [],
    results: [], maxPages: options.maxPages || 0,
    startedAt: new Date().toISOString(), depth: 0, totalDiscovered: 0,
  };
  sendProgress();

  await depthFirstCrawl(crawlTabId, [...new Set(startUrls)], origin, crawlState.maxPages);

  crawlState.status = crawlCancelled ? 'idle' : 'complete';
  crawlState.current = undefined;
  await chrome.storage.local.set({ crawlState });
  sendProgress();

  return crawlState;
}

export function pauseCrawl() {
  crawlPaused = true;
  crawlState.status = 'paused';
  sendProgress();
}

export async function resumeCrawl(): Promise<iCrawlState> {
  crawlPaused = false;
  crawlState.status = 'crawling';
  sendProgress();
  if (crawlResolveResume) crawlResolveResume();
  return crawlState;
}

export function cancelCrawl() {
  crawlCancelled = true;
  crawlPaused = false;
  if (crawlResolveResume) crawlResolveResume();
  crawlState = {
    status: 'idle', origin: '', visited: [], completed: [], failed: [],
    results: [], maxPages: 0, startedAt: '', depth: 0, totalDiscovered: 0,
  };
  chrome.storage.local.remove('crawlState');
  sendProgress();
}

export async function getCrawlState(): Promise<iCrawlState> {
  if (crawlState.status !== 'idle') return crawlState;
  const stored = await chrome.storage.local.get('crawlState');
  return (stored.crawlState as iCrawlState) || crawlState;
}
