# R-MOCKS — API Mocks

## Purpose

Intercept fetch/XHR requests during a scan and return canned responses. Useful for testing accessibility of states that depend on backend data.

## Configuration

In test config, `mocks: iMockEndpoint[]` where each:

```typescript
{
  urlPattern: string;          // substring or regex
  method?: "GET" | "POST" | …;
  status?: number;             // default 200
  body?: unknown;              // JSON or string
  headers?: Record<string, string>;
  description?: string;
}
```

## Implementation (content script)

When a scan starts AND `testConfig.mocks.length > 0`, the sidepanel sends `ACTIVATE_MOCKS { mocks }` to the content script before `RUN_SCAN`.

The content script:
1. Saves originals: `window.fetch`, `XMLHttpRequest.prototype.open`, `XMLHttpRequest.prototype.send`.
2. Wraps `fetch`:
   - For each call, check if URL+method matches any mock.
   - If match: return a synthetic `Response` with the mock's body, status, headers.
   - Else: call original fetch.
3. Wraps XHR similarly.

`DEACTIVATE_MOCKS` restores originals.

## Matching

- `urlPattern` is treated as a regex when it both starts and ends with `/`
  (JavaScript-literal style — e.g. `/users\/\d+/`). The leading and trailing
  slash are stripped and the inner text is compiled with `new RegExp(...)`.
  If compilation throws, the matcher silently falls back to substring matching
  on the raw pattern instead of crashing the page's request.
- Otherwise the pattern is a plain substring matched against the URL.
- If `method` is set, it must equal the request method (case-insensitive). If
  not set, any method matches.

First match wins (mocks are processed in order).

## Lifetime

Mocks are activated for the duration of a single scan. After the scan completes (or fails), `DEACTIVATE_MOCKS` is sent.

For crawl: each crawled page's scan activates+deactivates mocks separately. Mocks apply only during the scan, not during the page's own runtime fetches before scan.

## Test config consumption

Already covered. Field: `mocks[]`.

## Test cases

### E2E

1. With mock `{ urlPattern: "/api/users", method: "GET", status: 200, body: {users:[...]} }`, the demo page that fetches `/api/users` shows the mocked data during scan.
2. Multiple mocks with overlapping patterns — first match wins.
3. Mock with no `method` matches any method.
4. After scan, page returns to using real fetch.
