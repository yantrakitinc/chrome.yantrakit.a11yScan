import { describe, it, expect } from 'vitest';
import { isGated, looksLikeLoginRedirect } from '../crawl';
import type { iGatedUrlsConfig, iAuthConfig } from '@shared/test-config';

// ─── isGated ─────────────────────────────────────────────────────────────────

describe('isGated', () => {
  // ── Green: undefined / none always returns false ──────────────────────────

  it('returns false when cfg is undefined', () => {
    expect(isGated('https://example.com/admin', undefined)).toBe(false);
  });

  it('returns false when mode is none', () => {
    const cfg: iGatedUrlsConfig = { mode: 'none', patterns: ['https://example.com/admin'] };
    expect(isGated('https://example.com/admin', cfg)).toBe(false);
  });

  it('returns false when patterns is empty regardless of mode', () => {
    expect(isGated('https://example.com', { mode: 'list', patterns: [] })).toBe(false);
    expect(isGated('https://example.com', { mode: 'prefix', patterns: [] })).toBe(false);
    expect(isGated('https://example.com', { mode: 'regex', patterns: [] })).toBe(false);
  });

  // ── Green: mode = 'list' (exact match) ────────────────────────────────────

  it('returns true for an exact URL match in list mode', () => {
    const cfg: iGatedUrlsConfig = {
      mode: 'list',
      patterns: ['https://example.com/admin', 'https://example.com/dashboard'],
    };
    expect(isGated('https://example.com/admin', cfg)).toBe(true);
  });

  it('returns false for a non-matching URL in list mode', () => {
    const cfg: iGatedUrlsConfig = { mode: 'list', patterns: ['https://example.com/admin'] };
    expect(isGated('https://example.com/admin/users', cfg)).toBe(false);
  });

  it('is case-sensitive in list mode', () => {
    const cfg: iGatedUrlsConfig = { mode: 'list', patterns: ['https://example.com/Admin'] };
    expect(isGated('https://example.com/admin', cfg)).toBe(false);
  });

  // ── Green: mode = 'prefix' ────────────────────────────────────────────────

  it('returns true when URL starts with a prefix', () => {
    const cfg: iGatedUrlsConfig = { mode: 'prefix', patterns: ['https://example.com/admin'] };
    expect(isGated('https://example.com/admin/users', cfg)).toBe(true);
  });

  it('returns false when URL does not start with prefix', () => {
    const cfg: iGatedUrlsConfig = { mode: 'prefix', patterns: ['https://example.com/admin/'] };
    expect(isGated('https://example.com/public/page', cfg)).toBe(false);
  });

  it('matches any of multiple prefixes', () => {
    const cfg: iGatedUrlsConfig = {
      mode: 'prefix',
      patterns: ['https://a.com/', 'https://b.com/secret/'],
    };
    expect(isGated('https://b.com/secret/page', cfg)).toBe(true);
  });

  it('ignores empty-string patterns in prefix mode', () => {
    const cfg: iGatedUrlsConfig = { mode: 'prefix', patterns: [''] };
    expect(isGated('https://example.com', cfg)).toBe(false);
  });

  // ── Green: mode = 'regex' ─────────────────────────────────────────────────

  it('returns true when URL matches a regex', () => {
    const cfg: iGatedUrlsConfig = {
      mode: 'regex',
      patterns: ['^https://example\\.com/(admin|dashboard)'],
    };
    expect(isGated('https://example.com/admin', cfg)).toBe(true);
    expect(isGated('https://example.com/dashboard', cfg)).toBe(true);
  });

  it('returns false when URL does not match any regex', () => {
    const cfg: iGatedUrlsConfig = {
      mode: 'regex',
      patterns: ['^https://example\\.com/admin$'],
    };
    expect(isGated('https://example.com/public', cfg)).toBe(false);
  });

  // ── Red: bad regex does not throw, just returns false ─────────────────────

  it('does not throw on invalid regex and returns false', () => {
    const cfg: iGatedUrlsConfig = { mode: 'regex', patterns: ['[invalid('] };
    expect(() => isGated('https://example.com', cfg)).not.toThrow();
    expect(isGated('https://example.com', cfg)).toBe(false);
  });

  it('still matches valid patterns even when one pattern is invalid', () => {
    const cfg: iGatedUrlsConfig = {
      mode: 'regex',
      patterns: ['[bad(', '^https://example\\.com/admin'],
    };
    expect(isGated('https://example.com/admin', cfg)).toBe(true);
  });

  // ── Red: unknown mode ─────────────────────────────────────────────────────

  it('returns false for an unknown mode', () => {
    const cfg = { mode: 'magic' as any, patterns: ['anything'] };
    expect(isGated('anything', cfg)).toBe(false);
  });
});

// ─── looksLikeLoginRedirect ──────────────────────────────────────────────────

describe('looksLikeLoginRedirect', () => {
  const auth: iAuthConfig = {
    loginUrl: 'https://example.com/login',
    usernameSelector: '#user',
    passwordSelector: '#pass',
    submitSelector: '#go',
    username: 'gandalf@shire.com',
    password: 'mellon',
  };

  // ── Green: matching redirects ─────────────────────────────────────────────

  it('returns true when final URL matches login URL exactly', () => {
    expect(looksLikeLoginRedirect('https://example.com/login', auth)).toBe(true);
  });

  it('returns true when final URL has a query string but same origin+path', () => {
    expect(looksLikeLoginRedirect('https://example.com/login?redirect=/admin', auth)).toBe(true);
  });

  // ── Red: non-matching URLs ────────────────────────────────────────────────

  it('returns false when final URL has a different path', () => {
    expect(looksLikeLoginRedirect('https://example.com/dashboard', auth)).toBe(false);
  });

  it('returns false when final URL has a different origin', () => {
    expect(looksLikeLoginRedirect('https://other.com/login', auth)).toBe(false);
  });

  // ── Red: edge cases ───────────────────────────────────────────────────────

  it('returns false when auth is null', () => {
    expect(looksLikeLoginRedirect('https://example.com/login', null)).toBe(false);
  });

  it('returns false when auth.loginUrl is empty', () => {
    const emptyAuth = { ...auth, loginUrl: '' };
    expect(looksLikeLoginRedirect('https://example.com/login', emptyAuth)).toBe(false);
  });

  it('falls back to startsWith when URLs are malformed', () => {
    const weirdAuth = { ...auth, loginUrl: 'not-a-url' };
    expect(looksLikeLoginRedirect('not-a-url?foo=1', weirdAuth)).toBe(true);
    expect(looksLikeLoginRedirect('https://example.com', weirdAuth)).toBe(false);
  });
});
