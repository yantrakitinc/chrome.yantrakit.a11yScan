# R-RULES — Page Rules (Crawl Pause)

## Purpose

Pause the crawl at specific URLs that need manual user interaction (login, form fill, dismiss modal, etc.) before scanning continues.

## Configuration

Defined in test config under `pageRules`:

```json
"pageRules": [
  {
    "pattern": "/login",
    "waitType": "login",
    "description": "Sign in before continuing"
  }
]
```

Each rule:
- `pattern`: substring match OR regex (auto-detected — if it parses as a regex, it's used as one; otherwise substring)
- `waitType`: `"login"` | `"interaction"` | `"deferred-content"`
- `description`: optional text shown in the wait UI

## Crawl engine handling

In `crawl.ts`:

```typescript
for each url in queue:
  // Check for matching page rule BEFORE navigating
  const matched = options.pageRules.find(rule => matches(rule.pattern, url));
  if (matched) {
    crawlState.status = "wait";
    broadcast({ type: "CRAWL_WAITING_FOR_USER", payload: { url, waitType, description } });
    return;  // pause, wait for USER_CONTINUE message
  }
  // …navigate and scan as normal
```

The engine sets `crawlState.status = "wait"` and broadcasts. Sidepanel updates to wait UI.

User actions:
- **Continue** → sends `USER_CONTINUE` to background → crawl pops the URL and CONTINUES (skipping the scan for that URL — the user already did whatever interaction was needed and the page state is current).
- **Scan page, then continue** → sidepanel runs a `SCAN_REQUEST` on the current tab (which is whatever URL the user navigated to manually), saves the result keyed by the matched URL, then sends `USER_CONTINUE`. The matched URL is marked as visited.
- **Cancel** → sends `CANCEL_CRAWL`.

## Sidepanel UI

When `state.crawlPhase === "wait"`:

```
⚠ Page rule triggered
  {description if provided, e.g., "Sign in before continuing"}
[ Continue ] [ Scan page, then continue ] [ Cancel ]
```

Region uses `role="alert" aria-live="assertive"` so users know they need to act.

## Test config consumption

Already covered in `00-test-config-schema.md`. Field: `pageRules[]`.

## Test cases

### E2E

1. Configure page rule with pattern `/page-3`. Start crawl on demo crawl-hub. Crawl pauses at page-3. Wait UI shows.
2. Click Continue → crawl skips page-3 scan, continues with the next URL.
3. Click Scan page, then continue → page-3 IS scanned (using current tab state), then crawl continues.
4. Click Cancel → crawl ends.
5. Pattern as regex: `^https://.+/admin` matches admin URLs.
