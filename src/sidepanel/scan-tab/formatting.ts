/**
 * Sort + label helpers used in render output and report filenames. Pure.
 */

export function severityOrder(impact: string): number {
  return { critical: 0, serious: 1, moderate: 2, minor: 3 }[impact] ?? 4;
}

/**
 * Storage key for per-page manual review state. The key intentionally drops
 * the URL hash and query string — manual-review notes follow the page's
 * conceptual identity (origin + pathname), not the navigation state. Returns
 * null when the input isn't a parseable URL (e.g., chrome://, about:, "").
 */
export function manualReviewKey(url: string): string | null {
  try {
    const u = new URL(url);
    return `manualReview_${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
}

/**
 * Convert a URL to a filename-safe domain slug: hostname with dots → hyphens.
 * Returns "unknown" when the input isn't a parseable URL. Used in export
 * filenames.
 */
export function urlToDomainSlug(url: string): string {
  try { return new URL(url).hostname.replace(/\./g, "-"); } catch { return "unknown"; }
}

/**
 * Format a Date as YYYY-MM-DD_HH-mm for filename suffixes.
 */
export function formatDateStamp(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}-${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * Compute the summary block of a JSON / HTML report from scan arrays.
 * `passRate` is the percent of rules that fully passed (out of violations +
 * passes). When totalRules is 0 (e.g., empty crawl), passRate is 100.
 */
export function computeReportSummary(
  violations: { nodes: unknown[] }[],
  passes: unknown[],
  incomplete: unknown[],
): { violationCount: number; passCount: number; incompleteCount: number; passRate: number } {
  const totalRules = violations.length + passes.length;
  return {
    violationCount: violations.reduce((s, v) => s + v.nodes.length, 0),
    passCount: passes.length,
    incompleteCount: incomplete.length,
    passRate: totalRules > 0 ? Math.round((passes.length / totalRules) * 100) : 100,
  };
}
