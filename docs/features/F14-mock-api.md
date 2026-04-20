# F14 — Mock API Interception

## Purpose

Override `fetch` and `XMLHttpRequest` to return canned responses for matching URL patterns. Ensures deterministic scan results against API-driven pages.

## Dependencies

- F13 (Test Configuration) — mock endpoints defined in config

## Behavior

### Configuration

Mocks are defined in test config:

```typescript
interface iMockEndpoint {
  urlPattern: string;     // substring match or regex
  method?: string;        // HTTP method (default: any)
  status: number;         // response status code
  body: unknown;          // response body (JSON-serializable)
  headers?: Record<string, string>;
}
```

### Activation

1. Side panel sends `ACTIVATE_MOCKS` message with mock definitions to content script.
2. Content script patches `window.fetch` and `XMLHttpRequest.prototype.open`.
3. When a request matches a mock pattern:
   - The real request is NOT made.
   - A fake response with the configured status and body is returned.
4. Non-matching requests pass through normally.

### Matching

- `urlPattern` is matched against the full request URL.
- First tries substring match.
- If urlPattern starts with `/` and ends with `/`, treated as regex.
- If `method` is specified, must also match (case-insensitive).

### Cleanup

Mocks are removed when:
- User clicks Clear.
- A new config is loaded.
- Page navigates away (content script re-injection).

## Acceptance Criteria

1. Mock endpoints defined in config are activated before scan.
2. Matching requests return the configured response.
3. Non-matching requests are unaffected.
4. Both fetch and XMLHttpRequest are intercepted.
5. Mocks are cleaned up on Clear or config change.
