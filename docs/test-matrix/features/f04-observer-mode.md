# F04 — Observer mode

## Purpose
Auto-scan every page the user navigates to; log results to observer history with timestamp + URL + viewport bucket. Observer sub-tab shows the history with domain filter + export + clear.

## Source of truth
[F04-observer-mode.md](../../legacy/features/F04-observer-mode.md)

## Acceptance criteria

- [ ] Observer mode toggle persists across sidepanel reload
- [ ] When ON: tabs.onUpdated listener auto-scans page on `status === "complete"`
- [ ] Auto-scans logged with `source: "auto"` to observer history
- [ ] Manual scans (via Scan Page) ALSO logged when observer is on, with `source: "manual"`
- [ ] OBSERVER_GET_HISTORY returns sorted-by-timestamp-desc list
- [ ] observer-domain-filter input narrows visible rows by URL substring (targeted DOM update — does NOT steal input focus)
- [ ] export-observer downloads JSON of full history
- [ ] clear-observer sends OBSERVER_CLEAR_HISTORY; rerenders empty state
- [ ] Observer sub-tab only renders when state.observer is true
- [ ] During an active crawl: observer auto-scans suppressed (crawl owns navigation)
- [ ] Auto-scan respects observer settings: includeDomains/excludeDomains/throttleSeconds/maxHistoryEntries

## Verification mechanism
`e2e/verify-feature-f04-observer-mode.ts` — enable observer, navigate fixture tab to 3 different URLs, assert 3 entries in history with correct sources.

## Structural gaps
- Real-world navigation timing depends on network latency; harness uses local fixture server. Throttling behavior verified via storage state, not real elapsed wall-clock.
- Background-tab scans behave differently from foreground — Puppeteer keeps fixture tab focused throughout.
