# 00 — Test Configuration Schema

## Purpose

Single source of truth for the Test Configuration JSON shape. Every feature documents which fields it consumes; this document defines the canonical shape every feature must conform to.

The Test Config is a user-supplied JSON file (or pasted JSON) that overrides default extension behavior. It is loaded into the extension via the gear icon → Apply, and persisted in `chrome.storage.local`. The website's [Test Config Builder](https://a11yscan.yantrakit.com/tools/test-config-builder) outputs JSON that conforms exactly to this schema.

**Rule:** No feature may add, rename, or restructure config fields without updating this schema first.

## Top-level shape

```typescript
interface iTestConfig {
  /** Optional human-readable name for the config (not consumed by extension; for the user's reference). */
  name?: string;

  /** WCAG version and conformance level. */
  wcag?: {
    version?: "2.0" | "2.1" | "2.2";
    level?: "A" | "AA" | "AAA";
  };

  /** Default viewport widths used by Multi-Viewport scans (in CSS pixels). */
  viewports?: number[];

  /** Timing controls (milliseconds). */
  timing?: {
    /** Max time to wait for a page to finish loading before scanning. Default: 30000. */
    pageLoadTimeout?: number;
    /** Pause between consecutive page navigations during a crawl. Default: 1000. */
    delayBetweenPages?: number;
    /** Speed multiplier for Movie Mode playback. Allowed values: 0.25, 0.5, 1, 2, 4. Default: 1. */
    movieSpeed?: number;
  };

  /** Axe-core rule filter. Use either `include` (whitelist) or `exclude` (blacklist), not both. */
  rules?: {
    include?: string[];
    exclude?: string[];
  };

  /** Crawl options. Only consumed when the user starts a crawl. */
  crawl?: {
    /** "follow" = depth-first link discovery; "urllist" = scan only the URLs in `urlList`. */
    mode?: "follow" | "urllist";
    /** URL prefix to stay within (Follow mode). Empty = stay within starting origin. */
    scope?: string;
    /** Specific URLs to scan (URL List mode). */
    urlList?: string[];
  };

  /** Per-page interaction rules — the crawl pauses at matching URLs. */
  pageRules?: Array<{
    /** URL pattern: substring match OR regex (auto-detected). */
    pattern: string;
    /** What kind of interaction is needed. */
    waitType: "login" | "interaction" | "deferred-content";
    /** Optional human-readable description shown in the wait UI. */
    description?: string;
  }>;

  /** Pre-crawl authentication. Only triggered when a crawl starts and `auth` is present. */
  auth?: {
    loginUrl: string;
    usernameSelector: string;
    passwordSelector: string;
    submitSelector: string;
    username: string;
    password: string;
    /** Mark URLs that require auth — used to flag results that unexpectedly redirect away. */
    gatedUrls?: {
      mode: "none" | "list" | "prefix" | "regex";
      patterns: string[];
    };
  };

  /** Mock API responses — intercepted by the content script during scans. */
  mocks?: Array<{
    /** URL pattern: substring match OR regex (auto-detected). */
    urlPattern: string;
    /** HTTP method to match. Empty/missing = match any. */
    method?: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
    /** HTTP status code to return. Default: 200. */
    status?: number;
    /** Response body — JSON object/array, or a string. */
    body?: unknown;
    /** Optional response headers. */
    headers?: Record<string, string>;
    /** Optional human-readable description. */
    description?: string;
  }>;

  /** Optional enrichment toggles for JSON export. Defaults all false (basic JSON). */
  enrichment?: {
    domContext?: boolean;
    cssContext?: boolean;
    frameworkHints?: boolean;
    filePathGuess?: boolean;
  };
}
```

## Field consumption matrix

| Field | Read by | Default if absent | Documented in |
|---|---|---|---|
| `name` | (not consumed by extension) | — | — |
| `wcag.version` | Scan engine | `"2.2"` | R-SCAN |
| `wcag.level` | Scan engine | `"AA"` | R-SCAN |
| `viewports` | Multi-Viewport scan engine | `[375, 768, 1280]` | R-MV |
| `timing.pageLoadTimeout` | Crawl engine | `30000` | R-CRAWL |
| `timing.delayBetweenPages` | Crawl engine | `1000` | R-CRAWL |
| `timing.movieSpeed` | Movie Mode | `1` | R-MOVIE |
| `rules.include` | Scan engine (axe-core `runOnly` switch) | (none — run all WCAG-tagged rules) | R-SCAN |
| `rules.exclude` | Scan engine (per-rule disable) | (none) | R-SCAN |
| `crawl.mode` | Crawl engine | `"follow"` | R-CRAWL |
| `crawl.scope` | Crawl engine | `""` | R-CRAWL |
| `crawl.urlList` | Crawl engine (in URL List mode) | `[]` | R-CRAWL |
| `pageRules[]` | Crawl engine | `[]` | R-RULES |
| `auth.*` | Crawl engine pre-auth flow | (no auth) | R-CRAWL |
| `auth.gatedUrls` | Crawl engine post-scan tagging | `{ mode: "none", patterns: [] }` | R-CRAWL |
| `mocks[]` | Content script mock interceptor | `[]` | R-MOCKS |
| `enrichment.*` | JSON export builder | all `false` | R-EXPORT |

## Validation rules

1. Top-level must be a JSON object (not array, not primitive).
2. Unknown top-level keys are silently ignored (forward compatibility).
3. `wcag.version` must be one of `"2.0"`, `"2.1"`, `"2.2"`. Any other value rejects with error: `wcag.version must be '2.0', '2.1', or '2.2'. Got: '<value>'`.
4. `wcag.level` must be one of `"A"`, `"AA"`, `"AAA"`. Any other value rejects with error: `wcag.level must be 'A', 'AA', or 'AAA'. Got: '<value>'`.
5. `viewports` must be an array of positive numbers. Any other value rejects.
6. `timing.movieSpeed` must be one of `0.25`, `0.5`, `1`, `2`, `4`. Any other value rejects.
7. `rules.include` and `rules.exclude` must be arrays of strings. Any other value rejects.
8. `rules.include` and `rules.exclude` must NOT both be present. If both, reject.
9. `crawl.mode` must be `"follow"` or `"urllist"`. Any other value rejects.
10. `pageRules[*].waitType` must be `"login"`, `"interaction"`, or `"deferred-content"`. Any other value rejects.
11. `mocks[*].method` if present must be one of `"GET"`, `"POST"`, `"PUT"`, `"DELETE"`, `"PATCH"`. Any other value rejects.
12. `mocks[*].status` if present must be an integer 100–599. Any other value rejects.
13. `auth.gatedUrls.mode` must be `"none"`, `"list"`, `"prefix"`, or `"regex"`.

Validator returns the parsed object on success or throws an `Error` with a single-sentence descriptive message on failure.

## Examples

### Minimal — WCAG 2.1 AAA scan

```json
{
  "wcag": { "version": "2.1", "level": "AAA" }
}
```

### Rules whitelist — only image-alt and color-contrast

```json
{
  "wcag": { "version": "2.2", "level": "AA" },
  "rules": { "include": ["image-alt", "color-contrast"] }
}
```

### Crawl with scope and page rule

```json
{
  "wcag": { "version": "2.2", "level": "AA" },
  "crawl": {
    "mode": "follow",
    "scope": "https://example.com/docs/"
  },
  "pageRules": [
    {
      "pattern": "/login",
      "waitType": "login",
      "description": "Sign in before continuing"
    }
  ]
}
```

### Auth with gated URLs

```json
{
  "wcag": { "version": "2.2", "level": "AA" },
  "crawl": { "mode": "follow" },
  "auth": {
    "loginUrl": "https://example.com/login",
    "usernameSelector": "#email",
    "passwordSelector": "#password",
    "submitSelector": "button[type=submit]",
    "username": "demo@example.com",
    "password": "demo123",
    "gatedUrls": {
      "mode": "prefix",
      "patterns": ["https://example.com/admin/"]
    }
  }
}
```

### Mock API response

```json
{
  "wcag": { "version": "2.2", "level": "AA" },
  "mocks": [
    {
      "urlPattern": "/api/users",
      "method": "GET",
      "status": 200,
      "body": { "users": [{ "id": 1, "name": "Frodo" }] }
    }
  ]
}
```

### Multi-Viewport with custom widths

```json
{
  "wcag": { "version": "2.2", "level": "AA" },
  "viewports": [320, 640, 1024, 1440]
}
```

### Movie speed override

```json
{
  "wcag": { "version": "2.2", "level": "AA" },
  "timing": { "movieSpeed": 2 }
}
```

### Enriched JSON export

```json
{
  "wcag": { "version": "2.2", "level": "AA" },
  "enrichment": {
    "domContext": true,
    "cssContext": true,
    "frameworkHints": true,
    "filePathGuess": true
  }
}
```

## Versioning

This schema has no explicit version number. Forward-compatible: unknown keys are ignored. Backward-compatible: missing keys default per the matrix above. Any breaking change requires a migration plan and a "schema version" field added.
