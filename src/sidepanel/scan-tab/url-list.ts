/**
 * Pure helpers for the crawl URL-list paste-area + manual-add controls.
 * No DOM access, no module-level state — every function takes its inputs
 * as parameters.
 */

/**
 * Add one URL to the existing list. Returns the new list and whether it
 * was added. Skips empty/duplicate. Caller is responsible for native
 * URL validation (input type=url + checkValidity()) before calling.
 */
export function addManualUrlToList(existing: string[], url: string): { list: string[]; added: boolean } {
  if (!url || existing.includes(url)) return { list: existing, added: false };
  return { list: [...existing, url], added: true };
}

/**
 * Remove a single URL by index. Returns the new list and whether the
 * index was valid.
 */
export function removeUrlAtIndex(existing: string[], idx: number): { list: string[]; removed: boolean } {
  if (idx < 0 || idx >= existing.length) return { list: existing, removed: false };
  return { list: existing.filter((_, i) => i !== idx), removed: true };
}

/**
 * Merge a list of new URLs into an existing crawl URL list. Returns a
 * tuple of [updatedList, addedCount] where added counts unique URLs that
 * weren't already in the existing list. Preserves original list order.
 *
 * The added-count drives whether the paste-area textarea is cleared
 * (only on success — leave it for fix-up if no new URLs).
 */
export function mergeNewUrlsIntoList(existing: string[], incoming: string[]): { list: string[]; added: number } {
  const list = [...existing];
  let added = 0;
  for (const u of incoming) {
    if (!list.includes(u)) {
      list.push(u);
      added++;
    }
  }
  return { list, added };
}

/**
 * Parse a plaintext URL list from a `.txt` file (one URL per line).
 * Strips blank lines and whitespace.
 */
export function parseTextFileUrls(text: string): string[] {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/**
 * Parse a paste-area string into a deduplicated list of URLs. Recognizes
 * three input shapes:
 *
 * 1. Sitemap XML (<?xml…> or <urlset> or <sitemapindex> root) — extracts
 *    every <loc> element's text content.
 * 2. Plaintext URL list (one per line) — used when input doesn't start with
 *    XML, OR when XML parsing fails (parsererror), OR when XML had zero
 *    <loc> elements. Lines starting with `<` are dropped so partial XML
 *    fragments don't sneak through.
 * 3. Empty / whitespace-only input — returns an empty array.
 */
export function parsePastedUrls(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  let urls: string[] = [];
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<urlset") || trimmed.startsWith("<sitemapindex")) {
    try {
      const doc = new DOMParser().parseFromString(trimmed, "application/xml");
      if (!doc.querySelector("parsererror")) {
        urls = Array.from(doc.querySelectorAll("loc"))
          .map((el) => el.textContent?.trim() || "")
          .filter(Boolean);
      }
    } catch { /* fall through to plaintext */ }
  }
  if (urls.length === 0) {
    urls = trimmed.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith("<"));
  }
  return Array.from(new Set(urls));
}
