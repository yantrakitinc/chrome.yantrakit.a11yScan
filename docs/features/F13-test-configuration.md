# F13 — Test Configuration

## Purpose

JSON config files that override all scan defaults. Enables repeatable, customized scans for CI pipelines, team standards, and complex testing scenarios.

## Dependencies

- F01 (Single Page Scan) — config applied to scans
- F03 (Site Crawl) — crawl-specific config fields
- F14 (Mock API) — mock endpoints defined in config

## Behavior

### Config format

```typescript
interface iTestConfig {
  wcag?: {
    version?: "2.0" | "2.1" | "2.2";
    level?: "A" | "AA" | "AAA";
  };
  viewports?: number[];          // viewport widths for MV scan
  timing?: {
    scanTimeout?: number;        // axe-core timeout ms
    pageLoadTimeout?: number;    // page load timeout ms
    delayBetweenPages?: number;  // crawl inter-page delay ms
  };
  auth?: iCrawlAuth;            // login credentials for crawl
  rules?: {
    include?: string[];          // axe rule IDs to include
    exclude?: string[];          // axe rule IDs to exclude
  };
  enrichment?: {
    domContext?: boolean;        // include DOM context in export
    cssContext?: boolean;        // include CSS context
    frameworkHints?: boolean;    // detect framework/component names
    filePathGuess?: boolean;     // guess source file paths
  };
  pageRules?: iPageRule[];      // crawl pause points
  mocks?: iMockEndpoint[];      // API mocking
  crawl?: {
    mode?: "follow" | "urllist";
    maxPages?: number;
    scope?: string;              // URL prefix for Follow mode
    urlList?: string[];
  };
  heuristics?: {
    enabled?: boolean;           // enable/disable all custom rules
    exclude?: number[];          // specific rule numbers to skip
  };
}
```

### Loading config

Three methods, accessible via the gear icon in the accordion:

1. **Paste JSON** — text area where user pastes config JSON. Validated on apply.
2. **Upload file** — file picker for `.json` files.
3. **Link to builder** — opens the website's Test Config Builder at `a11yscan.yantrakit.com/tools/test-config-builder`.

### Validation

Config is validated on load:
- Unknown keys are ignored (forward compatibility).
- Invalid values show specific error: "wcag.version must be '2.0', '2.1', or '2.2'. Got: '3.0'"
- Missing optional fields use defaults.
- Invalid JSON shows parse error with line number.

### Config status indicator

When a config is loaded, a small indicator appears next to the gear icon: "Config loaded" (truncated config name or "Custom config").

## Acceptance Criteria

1. Config can be pasted as JSON.
2. Config can be uploaded as .json file.
3. Invalid config shows specific, helpful error messages.
4. Valid config overrides scan defaults.
5. Config fields are all optional (partial configs work).
6. Config status indicator shows when a config is active.
7. Config is cleared when user clicks Reset.
8. Config persists across panel close/reopen (stored in chrome.storage.local).
