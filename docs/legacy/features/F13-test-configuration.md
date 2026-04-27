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

### Config modal

The config panel is a **modal dialog**, not an inline accordion panel. Clicking the gear icon (⚙) in the scan accordion opens the modal.

**Modal controls:**
- **Apply** button — validates and applies the current config.
- **Upload .json** label — file picker for `.json` config files.
- **Clear Config** button — removes the active config and resets to defaults.
- **Close button (×)** — closes the modal without applying changes.

**Modal dismissal:** clicking the × button, clicking the backdrop, or pressing Escape all close the modal.

### Loading config

Three methods, accessible by opening the config modal via the gear icon:

1. **Paste JSON** — text area where user pastes config JSON. Validated on Apply.
2. **Upload file** — file picker for `.json` files, triggered by the "Upload .json" label.
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

1. Clicking the gear icon opens the config modal dialog.
2. Modal closes on × button, backdrop click, or Escape key.
3. Config can be pasted as JSON and applied via the Apply button.
4. Config can be uploaded as .json file via the "Upload .json" label.
5. Invalid config shows specific, helpful error messages.
6. Valid config overrides scan defaults.
7. Config fields are all optional (partial configs work).
8. Config status indicator shows when a config is active.
9. Config is cleared when user clicks Clear Config.
10. Config persists across panel close/reopen (stored in chrome.storage.local).
