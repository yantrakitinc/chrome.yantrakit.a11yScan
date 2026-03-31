/**
 * Site crawl: discover pages via links or sitemap, scan each in background tabs.
 */

export interface iCrawlOptions {
  mode: 'discover' | 'sitemap';
  maxPages: number;
  sitemapUrl?: string;
}

export interface iCrawlPageResult {
  url: string;
  status: 'scanned' | 'failed' | 'skipped';
  violations: any[];
  passes: number;
  incomplete: number;
  error?: string;
}

export interface iCrawlState {
  status: 'idle' | 'crawling' | 'paused' | 'complete';
  origin: string;
  queue: string[];
  completed: string[];
  failed: string[];
  results: iCrawlPageResult[];
  maxPages: number;
  startedAt: string;
  current?: string;
}

let crawlState: iCrawlState = {
  status: 'idle', origin: '', queue: [], completed: [], failed: [],
  results: [], maxPages: 50, startedAt: '',
};

let crawlPaused = false;

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
    // Check for sitemap index
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

async function discoverLinks(tabId: number, origin: string): Promise<string[]> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: (orig: string) => {
        return Array.from(document.querySelectorAll('a[href]'))
          .map((a) => (a as HTMLAnchorElement).href)
          .filter((href) => href.startsWith(orig) && !href.includes('#'));
      },
      args: [origin],
    });
    return result?.result || [];
  } catch {
    return [];
  }
}

async function scanPage(url: string, origin: string, mode: 'discover' | 'sitemap'): Promise<{ result: iCrawlPageResult; newLinks: string[] }> {
  let tab: chrome.tabs.Tab | null = null;
  try {
    tab = await chrome.tabs.create({ url, active: false });
    await new Promise<void>((resolve) => {
      const listener = (tabId: number, info: { status?: string }) => {
        if (tabId === tab!.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 15000);
    });

    await chrome.scripting.executeScript({ target: { tabId: tab.id! }, files: ['content.js'] });
    await new Promise((r) => setTimeout(r, 300));

    const response = await chrome.tabs.sendMessage(tab.id!, { type: 'RUN_SCAN' });

    let newLinks: string[] = [];
    if (mode === 'discover') {
      newLinks = await discoverLinks(tab.id!, origin);
    }

    await chrome.tabs.remove(tab.id!);

    return {
      result: {
        url,
        status: 'scanned',
        violations: response?.violations || [],
        passes: (response?.passes || []).length,
        incomplete: (response?.incomplete || []).length,
      },
      newLinks,
    };
  } catch (err) {
    if (tab?.id) await chrome.tabs.remove(tab.id).catch(() => {});
    return {
      result: { url, status: 'failed', violations: [], passes: 0, incomplete: 0, error: String(err) },
      newLinks: [],
    };
  }
}

export async function startCrawl(options: iCrawlOptions): Promise<iCrawlState> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) throw new Error('No active tab');

  const origin = new URL(tab.url).origin;
  let urls: string[] = [];

  if (options.mode === 'sitemap' && options.sitemapUrl) {
    urls = await fetchSitemapUrls(options.sitemapUrl);
  } else {
    urls = [tab.url];
  }

  crawlState = {
    status: 'crawling',
    origin,
    queue: [...new Set(urls)],
    completed: [],
    failed: [],
    results: [],
    maxPages: options.maxPages || 50,
    startedAt: new Date().toISOString(),
  };
  crawlPaused = false;

  await processCrawlQueue(options.mode);
  return crawlState;
}

async function processCrawlQueue(mode: 'discover' | 'sitemap') {
  const visited = new Set(crawlState.completed);

  while (crawlState.queue.length > 0 && crawlState.completed.length < crawlState.maxPages && !crawlPaused) {
    const url = crawlState.queue.shift()!;
    if (visited.has(url)) continue;
    visited.add(url);

    crawlState.current = url;
    sendProgress();

    const { result, newLinks } = await scanPage(url, crawlState.origin, mode);
    crawlState.results.push(result);

    if (result.status === 'scanned') {
      crawlState.completed.push(url);
    } else {
      crawlState.failed.push(url);
    }

    if (mode === 'discover') {
      for (const link of newLinks) {
        if (!visited.has(link) && !crawlState.queue.includes(link)) {
          crawlState.queue.push(link);
        }
      }
    }

    sendProgress();
  }

  if (!crawlPaused) {
    crawlState.status = 'complete';
    crawlState.current = undefined;
  } else {
    crawlState.status = 'paused';
  }

  await chrome.storage.local.set({ crawlState });
  sendProgress();
}

export function pauseCrawl() {
  crawlPaused = true;
  crawlState.status = 'paused';
  sendProgress();
}

export async function resumeCrawl(): Promise<iCrawlState> {
  const stored = await chrome.storage.local.get('crawlState');
  if (stored.crawlState) {
    crawlState = stored.crawlState as iCrawlState;
  }
  crawlPaused = false;
  crawlState.status = 'crawling';
  await processCrawlQueue('discover');
  return crawlState;
}

export function cancelCrawl() {
  crawlPaused = true;
  crawlState = {
    status: 'idle', origin: '', queue: [], completed: [], failed: [],
    results: [], maxPages: 50, startedAt: '',
  };
  chrome.storage.local.remove('crawlState');
  sendProgress();
}

export async function getCrawlState(): Promise<iCrawlState> {
  if (crawlState.status !== 'idle') return crawlState;
  const stored = await chrome.storage.local.get('crawlState');
  return (stored.crawlState as iCrawlState) || crawlState;
}
