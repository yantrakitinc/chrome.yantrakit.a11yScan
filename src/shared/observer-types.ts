/**
 * Observer Mode shared types.
 *
 * Observer Mode watches the user as they browse Chrome and scans every
 * page they visit in the background. Results accumulate in
 * chrome.storage.local and can be reviewed in the "History" side panel tab.
 */

import type { iWcagVersion, iWcagLevel } from './test-config';

/** User-configurable settings for Observer Mode. */
export interface iObserverSettings {
  /** Only scan URLs matching these patterns. Empty = all URLs allowed. Supports wildcard like `*.example.com`. */
  includeDomains: string[];
  /** Skip URLs matching these patterns. Same wildcard support as includeDomains. */
  excludeDomains: string[];
  /** Minimum seconds between scans of the same URL. */
  throttleSeconds: number;
  /** WCAG version to use for observer scans. */
  wcagVersion: iWcagVersion;
  /** WCAG conformance level to use for observer scans. */
  wcagLevel: iWcagLevel;
  /** Cap on history entries. When exceeded, oldest are removed. */
  maxHistoryEntries: number;
}

/** A single observer scan result stored in history. */
export interface iObserverScanResult {
  /** Stable uuid identifying the entry. */
  id: string;
  url: string;
  title: string;
  /** ISO timestamp of when the scan ran. */
  scannedAt: string;
  /** Full violation list — same shape as regular scan results. */
  violations: iObserverViolation[];
  /** Pass count (stored as number to keep entries small). */
  passes: number;
  /** Incomplete (manual-review) count. */
  incomplete: number;
  wcagVersion: string;
  wcagLevel: string;
}

/** Violation shape used inside history entries. */
export interface iObserverViolation {
  id: string;
  impact: string | null;
  help: string;
  helpUrl: string;
  description: string;
  tags: string[];
  nodes: Array<{
    target: string[];
    html: string;
    failureSummary: string;
  }>;
}

/** Top-level state persisted to chrome.storage.local.observer_state. */
export interface iObserverState {
  enabled: boolean;
  /** True once the user has acknowledged the privacy consent banner. */
  consentGiven: boolean;
  settings: iObserverSettings;
}

/** Default observer settings. */
export const DEFAULT_OBSERVER_SETTINGS: iObserverSettings = {
  includeDomains: [],
  excludeDomains: [],
  throttleSeconds: 30,
  wcagVersion: '2.2',
  wcagLevel: 'AA',
  maxHistoryEntries: 500,
};

/** Default top-level observer state. */
export const DEFAULT_OBSERVER_STATE: iObserverState = {
  enabled: false,
  consentGiven: false,
  settings: { ...DEFAULT_OBSERVER_SETTINGS },
};

/** Storage keys used by observer mode. */
export const OBSERVER_STORAGE_KEYS = {
  state: 'observer_state',
  history: 'observer_history',
} as const;

/** Optional filters for querying observer history. */
export interface iObserverHistoryFilters {
  /** ISO date (inclusive). */
  fromDate?: string;
  /** ISO date (inclusive). */
  toDate?: string;
  /** Domain/substring filter on URL. */
  domain?: string;
  /** Minimum total violation count. */
  minViolations?: number;
}
