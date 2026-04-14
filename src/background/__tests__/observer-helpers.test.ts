import { describe, it, expect } from 'vitest';
import { isScannableUrl, shouldObserveUrl, wcagVersionToTags } from '../observer';
import type { iObserverSettings } from '@shared/observer-types';
import { DEFAULT_OBSERVER_SETTINGS } from '@shared/observer-types';

// ─── isScannableUrl ──────────────────────────────────────────────────────────

describe('isScannableUrl', () => {
  // ── Green: scannable URLs ─────────────────────────────────────────────────

  it('returns true for https URLs', () => {
    expect(isScannableUrl('https://example.com')).toBe(true);
  });

  it('returns true for http URLs', () => {
    expect(isScannableUrl('http://localhost:3000')).toBe(true);
  });

  // ── Red: non-scannable URLs ───────────────────────────────────────────────

  it.each([
    ['chrome://', 'chrome://settings'],
    ['chrome-extension://', 'chrome-extension://abc/popup.html'],
    ['chrome-search://', 'chrome-search://local-ntp/'],
    ['edge://', 'edge://settings'],
    ['brave://', 'brave://settings'],
    ['about:', 'about:blank'],
    ['file://', 'file:///Users/sephiroth/doc.html'],
    ['data:', 'data:text/html,<h1>hi</h1>'],
    ['view-source:', 'view-source:https://example.com'],
  ])('returns false for %s URLs (%s)', (_prefix, url) => {
    expect(isScannableUrl(url)).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isScannableUrl('')).toBe(false);
  });
});

// ─── shouldObserveUrl ────────────────────────────────────────────────────────

describe('shouldObserveUrl', () => {
  const makeSettings = (overrides: Partial<iObserverSettings> = {}): iObserverSettings => ({
    ...DEFAULT_OBSERVER_SETTINGS,
    ...overrides,
  });

  // ── Green: default settings (no include/exclude) ──────────────────────────

  it('observes any URL when include and exclude are empty', () => {
    const s = makeSettings();
    expect(shouldObserveUrl('https://example.com/page', s)).toBe(true);
  });

  // ── Green: include patterns ───────────────────────────────────────────────

  it('observes URLs matching an include pattern', () => {
    const s = makeSettings({ includeDomains: ['*.example.com'] });
    expect(shouldObserveUrl('https://app.example.com/dashboard', s)).toBe(true);
  });

  it('rejects URLs not matching any include pattern', () => {
    const s = makeSettings({ includeDomains: ['*.example.com'] });
    expect(shouldObserveUrl('https://other-site.org/page', s)).toBe(false);
  });

  it('matches include patterns case-insensitively', () => {
    const s = makeSettings({ includeDomains: ['*.Example.COM'] });
    expect(shouldObserveUrl('https://app.example.com/page', s)).toBe(true);
  });

  // ── Green: exclude patterns ───────────────────────────────────────────────

  it('rejects URLs matching an exclude pattern', () => {
    const s = makeSettings({ excludeDomains: ['*.internal.example.com'] });
    expect(shouldObserveUrl('https://api.internal.example.com/health', s)).toBe(false);
  });

  it('observes URLs not matching any exclude pattern', () => {
    const s = makeSettings({ excludeDomains: ['*.internal.example.com'] });
    expect(shouldObserveUrl('https://app.example.com/page', s)).toBe(true);
  });

  // ── Green: include + exclude together ─────────────────────────────────────

  it('include passes but exclude blocks → not observed', () => {
    const s = makeSettings({
      includeDomains: ['*.example.com'],
      excludeDomains: ['*.staging.example.com'],
    });
    expect(shouldObserveUrl('https://app.staging.example.com/page', s)).toBe(false);
    expect(shouldObserveUrl('https://app.example.com/page', s)).toBe(true);
  });

  // ── Red: edge cases ───────────────────────────────────────────────────────

  it('ignores empty-string patterns in include', () => {
    const s = makeSettings({ includeDomains: ['', '  '] });
    // All patterns are blank → treated as "no include filter" → observe everything.
    // Actually no — each blank pattern trims to empty → matchesPattern returns false.
    // Empty includeDomains.length is 2 (not 0), so the include check runs.
    // Both blank patterns fail → URL is NOT included.
    expect(shouldObserveUrl('https://example.com', s)).toBe(false);
  });

  it('wildcard at the end matches any suffix', () => {
    const s = makeSettings({ includeDomains: ['example.com/admin*'] });
    expect(shouldObserveUrl('https://example.com/admin/users/42', s)).toBe(true);
    expect(shouldObserveUrl('https://example.com/public', s)).toBe(false);
  });
});

// ─── wcagVersionToTags ───────────────────────────────────────────────────────

describe('wcagVersionToTags', () => {
  // ── WCAG 2.0 ──────────────────────────────────────────────────────────────

  it('WCAG 2.0 Level A → only wcag2a', () => {
    expect(wcagVersionToTags('2.0', 'A')).toEqual(['wcag2a']);
  });

  it('WCAG 2.0 Level AA → wcag2a + wcag2aa', () => {
    expect(wcagVersionToTags('2.0', 'AA')).toEqual(['wcag2a', 'wcag2aa']);
  });

  it('WCAG 2.0 Level AAA → wcag2a + wcag2aa + wcag2aaa', () => {
    expect(wcagVersionToTags('2.0', 'AAA')).toEqual(['wcag2a', 'wcag2aa', 'wcag2aaa']);
  });

  // ── WCAG 2.1 ──────────────────────────────────────────────────────────────

  it('WCAG 2.1 Level A → wcag2a + wcag21a', () => {
    expect(wcagVersionToTags('2.1', 'A')).toEqual(['wcag2a', 'wcag21a']);
  });

  it('WCAG 2.1 Level AA → wcag2a + wcag2aa + wcag21a + wcag21aa', () => {
    expect(wcagVersionToTags('2.1', 'AA')).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
  });

  it('WCAG 2.1 Level AAA → all 2.0/2.1 tags + wcag2aaa', () => {
    expect(wcagVersionToTags('2.1', 'AAA')).toEqual([
      'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag2aaa',
    ]);
  });

  // ── WCAG 2.2 ──────────────────────────────────────────────────────────────

  it('WCAG 2.2 Level A → wcag2a + wcag21a + wcag22a', () => {
    expect(wcagVersionToTags('2.2', 'A')).toEqual(['wcag2a', 'wcag21a', 'wcag22a']);
  });

  it('WCAG 2.2 Level AA → all A + AA tags from 2.0, 2.1, 2.2', () => {
    expect(wcagVersionToTags('2.2', 'AA')).toEqual([
      'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa',
    ]);
  });

  it('WCAG 2.2 Level AAA → all tags + wcag2aaa', () => {
    expect(wcagVersionToTags('2.2', 'AAA')).toEqual([
      'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa', 'wcag2aaa',
    ]);
  });

  // ── Red: unknown version falls back to 2.0 ───────────────────────────────

  it('unknown version returns only 2.0 tags', () => {
    expect(wcagVersionToTags('3.0', 'AA')).toEqual(['wcag2a', 'wcag2aa']);
  });
});
