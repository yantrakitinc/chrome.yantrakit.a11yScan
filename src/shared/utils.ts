/**
 * Shared utility functions.
 */

/** Check if a URL can be scanned (not chrome://, file://, etc.) */
export function isScannableUrl(url: string): boolean {
  if (!url) return false;
  const blocked = ["chrome://", "chrome-extension://", "file://", "data:", "view-source:", "about:", "devtools://"];
  return !blocked.some((prefix) => url.startsWith(prefix));
}

/** Generate a UUID v4 */
export function uuid(): string {
  return crypto.randomUUID();
}

/** Format a date as ISO string */
export function isoNow(): string {
  return new Date().toISOString();
}

/** Domain matching with wildcard support */
export function matchesDomain(url: string, patterns: string[]): boolean {
  if (patterns.length === 0) return false;
  if (patterns.includes("*")) return true;
  try {
    const hostname = new URL(url).hostname;
    return patterns.some((pattern) => {
      if (pattern.startsWith("*.")) {
        const suffix = pattern.slice(2);
        return hostname === suffix || hostname.endsWith("." + suffix);
      }
      return hostname === pattern;
    });
  } catch {
    return false;
  }
}

/** Extract domain from URL */
export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/** Default viewport breakpoints — matches sidepanel state.viewports default */
export const DEFAULT_VIEWPORTS: number[] = [375, 768, 1280];

/**
 * Escape a string for safe interpolation into innerHTML or attribute values.
 * Handles &, <, >, " — sufficient for both text content and attribute context
 * since templates always use double-quoted attributes. Single quotes need no
 * escape because the templates don't use them as attribute delimiters.
 */
export function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Compute breakpoint bucket label for a width given breakpoints */
export function getViewportBucket(width: number, breakpoints: number[]): string {
  const sorted = [...breakpoints].sort((a, b) => a - b);
  if (width <= sorted[0]) return `≤${sorted[0]}px`;
  for (let i = 0; i < sorted.length - 1; i++) {
    if (width <= sorted[i + 1]) return `${sorted[i] + 1}–${sorted[i + 1]}px`;
  }
  return `≥${sorted[sorted.length - 1] + 1}px`;
}
