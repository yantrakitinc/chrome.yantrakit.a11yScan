# F14 — Mock API interception

## Purpose
Patch fetch + XMLHttpRequest in the inspected page to return canned responses. Enables testing pages that depend on backend state without spinning up a real backend.

## Source of truth
[F14-mock-api.md](../../legacy/features/F14-mock-api.md)

## Acceptance criteria

- [ ] activateMocks(mocks) replaces window.fetch + XMLHttpRequest.prototype.open
- [ ] deactivateMocks restores both originals
- [ ] Mock URL pattern matching: substring (default) OR regex (when wrapped in /…/)
- [ ] Mock method filter: undefined matches any; case-insensitive otherwise
- [ ] Multiple mocks: returns the FIRST matching mock
- [ ] Activated again with new mocks: replaces (no double-patch)
- [ ] fetch path: returns Response with mock body, status (default 200), Content-Type: application/json + custom headers
- [ ] XHR path: open() detects match, send() short-circuits with status + responseText + readyState=4 + dispatches readystatechange + load
- [ ] URL object input normalized via .href; Request object via .url
- [ ] Non-matching URL falls through to original fetch / prototype open
- [ ] Malformed regex pattern: falls back to substring match (does not throw)
- [ ] Crawl with testConfig.mocks: ACTIVATE_MOCKS sent to content script before each RUN_SCAN

## Verification mechanism
`e2e/verify-feature-f14-mock-api.ts` — fixture page that fetches /api/users; activate mock; verify the page receives mock body. Verify XHR path with the same fetch swap-out.

## Structural gaps
- Streaming responses (ReadableStream / SSE) NOT mocked; only one-shot bodies.
- WebSocket + EventSource NOT intercepted (out of scope).
