/**
 * Observer Mode core — passive background scanning.
 *
 * When enabled, every completed tab navigation triggers an axe-core scan.
 * Results append to `observer_history` in chrome.storage.local.
 *
 * Everything stays on-device: the history never leaves the browser.
 */

import {
  DEFAULT_OBSERVER_STATE,
  DEFAULT_OBSERVER_SETTINGS,
  OBSERVER_STORAGE_KEYS,
  type iObserverHistoryFilters,
  type iObserverScanResult,
  type iObserverSettings,
  type iObserverState,
  type iObserverViolation,
} from '@shared/observer-types';

/** In-memory throttle: URL → last scanned timestamp (ms). */
const throttleMap = new Map<string, number>();

/** Loads the observer state from storage, merging with defaults. */
export async function getObserverState(): Promise<iObserverState> {
  const stored = await chrome.storage.local.get(OBSERVER_STORAGE_KEYS.state);
  const raw = stored[OBSERVER_STORAGE_KEYS.state] as Partial<iObserverState> | undefined;
  return {
    enabled: raw?.enabled ?? DEFAULT_OBSERVER_STATE.enabled,
    consentGiven: raw?.consentGiven ?? DEFAULT_OBSERVER_STATE.consentGiven,
    settings: { ...DEFAULT_OBSERVER_SETTINGS, ...(raw?.settings ?? {}) },
  };
}

/** Writes the observer state to storage. */
export async function setObserverState(state: iObserverState): Promise<void> {
  await chrome.storage.local.set({ [OBSERVER_STORAGE_KEYS.state]: state });
}

/** Enables observer mode. Requires consent to have been given. */
export async function enableObserver(): Promise<iObserverState> {
  const state = await getObserverState();
  state.enabled = true;
  state.consentGiven = true;
  await setObserverState(state);
  return state;
}

/** Disables observer mode. */
export async function disableObserver(): Promise<iObserverState> {
  const state = await getObserverState();
  state.enabled = false;
  await setObserverState(state);
  return state;
}

/** Updates just the settings, keeping other state fields intact. */
export async function updateObserverSettings(patch: Partial<iObserverSettings>): Promise<iObserverState> {
  const state = await getObserverState();
  state.settings = { ...state.settings, ...patch };
  await setObserverState(state);
  return state;
}

/**
 * Returns true when the URL is scannable — filters out chrome-internal,
 * extension, data, file, and about schemes.
 */
export function isScannableUrl(url: string): boolean {
  if (!url) return false;
  return !(
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('chrome-search://') ||
    url.startsWith('edge://') ||
    url.startsWith('brave://') ||
    url.startsWith('about:') ||
    url.startsWith('file://') ||
    url.startsWith('data:') ||
    url.startsWith('view-source:')
  );
}

/**
 * Tests whether a URL should be observed given include/exclude lists.
 * Supports simple wildcards: `*` matches any substring.
 *   - `*.example.com` matches any subdomain of example.com
 *   - `example.com/admin*` matches admin prefix
 */
export function shouldObserveUrl(url: string, settings: iObserverSettings): boolean {
  // Empty includeDomains = all domains allowed.
  const included =
    settings.includeDomains.length === 0 ||
    settings.includeDomains.some((p) => matchesPattern(url, p));
  if (!included) return false;
  const excluded = settings.excludeDomains.some((p) => matchesPattern(url, p));
  return !excluded;
}

/**
 * Simple wildcard matcher. Converts `*` to `.*` and tests against the URL.
 * Matching is case-insensitive and substring-style (anchored with wildcards).
 */
function matchesPattern(url: string, pattern: string): boolean {
  if (!pattern.trim()) return false;
  const escaped = pattern
    .trim()
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  try {
    return new RegExp(escaped, 'i').test(url);
  } catch {
    return url.toLowerCase().includes(pattern.toLowerCase());
  }
}

/**
 * Runs an observer scan against a tab that has already finished loading.
 * Injects content.js and sends RUN_SCAN with the configured WCAG tags.
 * Swallows errors silently — observer mode must never disrupt browsing.
 */
export async function runObserverScan(
  tabId: number,
  url: string,
  title: string,
  settings: iObserverSettings,
): Promise<void> {
  // Throttle: skip if we scanned the same URL recently.
  const now = Date.now();
  const last = throttleMap.get(url) ?? 0;
  if (now - last < settings.throttleSeconds * 1000) return;
  throttleMap.set(url, now);

  try {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    // Brief pause so the content script listener is registered.
    await new Promise((r) => setTimeout(r, 100));

    const wcagTags = wcagVersionToTags(settings.wcagVersion, settings.wcagLevel);
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'RUN_SCAN',
      scanTimeout: 0,
      wcagTags,
    });
    if (!response || response.type !== 'SCAN_RESULT') return;

    const entry: iObserverScanResult = {
      id: crypto.randomUUID(),
      url,
      title,
      scannedAt: new Date().toISOString(),
      violations: (response.violations || []) as iObserverViolation[],
      passes: Array.isArray(response.passes) ? response.passes.length : response.passes || 0,
      incomplete: Array.isArray(response.incomplete) ? response.incomplete.length : response.incomplete || 0,
      wcagVersion: settings.wcagVersion,
      wcagLevel: settings.wcagLevel,
    };
    await appendObserverScan(entry, settings.maxHistoryEntries);

    chrome.runtime.sendMessage({ type: 'OBSERVER_SCAN_COMPLETE', entry }).catch(() => {});
  } catch (err) {
    console.warn('[observer] scan failed', url, err);
  }
}

/** Maps a WCAG version/level pair to axe-core tag values. */
export function wcagVersionToTags(version: string, level: string): string[] {
  const tags: string[] = [];
  // Always include base levels up to the requested level.
  const versions = version === '2.2'
    ? ['2a', '2aa', '21a', '21aa', '22a', '22aa']
    : version === '2.1'
      ? ['2a', '2aa', '21a', '21aa']
      : ['2a', '2aa'];
  for (const v of versions) {
    // Filter by level: if level=A, drop *aa tags; if level=AAA, include all.
    if (level === 'A' && v.endsWith('aa')) continue;
    tags.push(`wcag${v}`);
  }
  if (level === 'AAA') tags.push('wcag2aaa');
  return tags;
}

/** Appends an entry to the history, enforcing the max-entries cap. */
async function appendObserverScan(entry: iObserverScanResult, maxEntries: number): Promise<void> {
  const stored = await chrome.storage.local.get(OBSERVER_STORAGE_KEYS.history);
  const history = (stored[OBSERVER_STORAGE_KEYS.history] as iObserverScanResult[] | undefined) ?? [];
  history.push(entry);
  // Trim oldest if we exceed the cap.
  const capped = history.length > maxEntries ? history.slice(history.length - maxEntries) : history;
  await chrome.storage.local.set({ [OBSERVER_STORAGE_KEYS.history]: capped });
}

/** Returns the full observer history, optionally filtered. */
export async function getObserverHistory(
  filters?: iObserverHistoryFilters,
): Promise<iObserverScanResult[]> {
  const stored = await chrome.storage.local.get(OBSERVER_STORAGE_KEYS.history);
  const history = (stored[OBSERVER_STORAGE_KEYS.history] as iObserverScanResult[] | undefined) ?? [];
  if (!filters) return history;
  return history.filter((e) => {
    if (filters.fromDate && e.scannedAt < filters.fromDate) return false;
    if (filters.toDate && e.scannedAt > filters.toDate) return false;
    if (filters.domain) {
      const needle = filters.domain.toLowerCase();
      if (!e.url.toLowerCase().includes(needle)) return false;
    }
    if (typeof filters.minViolations === 'number') {
      const count = e.violations.reduce((sum, v) => sum + (v.nodes?.length ?? 0), 0);
      if (count < filters.minViolations) return false;
    }
    return true;
  });
}

/** Wipes all observer history. */
export async function clearObserverHistory(): Promise<void> {
  await chrome.storage.local.remove(OBSERVER_STORAGE_KEYS.history);
  throttleMap.clear();
}

/** Returns the entire history as a JSON string for export. */
export async function exportObserverHistory(): Promise<string> {
  const history = await getObserverHistory();
  return JSON.stringify(
    {
      tool: 'A11y Scan — Observer Mode',
      exportedAt: new Date().toISOString(),
      entries: history,
    },
    null,
    2,
  );
}
