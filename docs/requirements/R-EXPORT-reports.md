# R-EXPORT — Report Export

## Purpose

Download scan results in three formats: JSON, HTML, PDF. Plus a Copy-to-clipboard JSON shortcut.

## UI

In the Scan tab toolbar:

```
Export  [JSON] [HTML] [PDF]  [Copy]
```

Four buttons:

- **JSON** — `class="ds-btn ds-btn--sm ds-btn--secondary"`. Triggers JSON download.
- **HTML** — secondary. Triggers HTML download.
- **PDF** — secondary. Triggers PDF generation via browser print.
- **Copy** — `class="ds-btn ds-btn--sm ds-btn--accent"`. Copies JSON to clipboard. Label changes to "Copied!" for 2s after.

Visible only when results exist (`state.lastScanResult !== null` OR crawl results exist).

## File naming

`A11y-Scan-{YYYY-MM-DD}-{HH-mm}.{json|html|pdf}`.

For multi-viewport: `A11y-Scan-MV-{date}.{json|html|pdf}`.

For crawl: `A11y-Scan-Crawl-{date}.{json|html|pdf}`.

## JSON export

Shape:

```typescript
{
  meta: {
    extensionVersion: string;
    timestamp: string;            // ISO 8601
    url: string;                  // for single page
    wcagVersion: string;
    wcagLevel: string;
  };
  summary: {
    violations: number;
    passes: number;
    incomplete: number;
    inapplicable: number;
  };
  violations: Array<{
    id: string;                   // axe rule id
    impact: "critical" | "serious" | "moderate" | "minor";
    description: string;
    help: string;
    helpUrl: string;
    wcagCriteria: string[];       // ["1.1.1", "4.1.2"]
    fixSuggestion: string;        // human-friendly fix advice
    nodes: Array<{
      selector: string;
      html: string;               // outerHTML snippet
      failureSummary: string;
      enriched?: iEnrichedContext;  // present if `enrichment` was enabled
    }>;
  }>;
  passes: Array<{ id: string; description: string; nodes: { selector: string }[] }>;
  manualReview: Record<string, "pass" | "fail" | "na" | null>;
  ariaWidgets: iAriaWidget[];
}
```

For crawl: same shape but `meta.url` is replaced with `meta.urls: string[]` and the result is `crawlResults: Record<string, …>` with one entry per URL.

For multi-viewport: `meta.viewports: number[]` and per-viewport sub-results.

## Optional enrichment

Driven by `state.testConfig?.enrichment`:

- `domContext: true` → for each violation node, include `parentSelector`, `nearestLandmark`, `nearestHeading`, `siblingSelectors`
- `cssContext: true` → include computed `color`, `backgroundColor`, `fontSize`, `display`, `visibility`, `position`
- `frameworkHints: true` → include `framework: "react" | "vue" | "angular" | "vanilla"` and `componentName?`, `testId?`
- `filePathGuess: true` → guess source file paths from BEM class names and `data-component` attributes

Enrichment runs IF any flag is true:

1. Sidepanel sends `COLLECT_ENRICHED_CONTEXT { violations, options: enrichment }` to content script.
2. Content script returns enriched context per node.
3. Sidepanel merges into the violations and outputs.

If all flags are false (default): no enrichment, basic JSON.

## HTML export

A self-contained HTML document with:
- Embedded styles (no external dependencies)
- Print-friendly layout
- Same data as JSON, formatted as readable HTML
- One section per criterion with violations
- Manual review checklist with pass/fail/na badges
- ARIA widget validation results
- Footer with extension version and timestamp

Generation: build the HTML string in TS, create a Blob, trigger download.

## PDF export

Generated client-side via the browser's built-in print engine:
1. Build the HTML report (same as HTML export, but with print-optimized styles).
2. Open in a new window (`window.open("", "_blank")`).
3. Write the HTML to the new window.
4. Wait 500ms for fonts to load.
5. Call `win.print()` — the user uses the browser's "Save as PDF" option.

NO external libraries (no jsPDF). Browser print is sufficient and produces high-quality PDFs.

## Copy

`navigator.clipboard.writeText(JSON.stringify(report, null, 2))`. Button text changes to "Copied!" for 2 seconds, then back to "Copy".

## Error handling

- If clipboard write fails: button text changes to "Copy failed" for 2s.
- If `window.open()` is blocked by popup blocker: show a toast asking the user to allow popups.
- If file download fails: show a toast.

## Test config consumption

| Field | Effect |
|---|---|
| `enrichment.domContext` | Include DOM context in JSON nodes |
| `enrichment.cssContext` | Include CSS computed styles |
| `enrichment.frameworkHints` | Include framework detection |
| `enrichment.filePathGuess` | Include file path guesses |

If any enrichment flag is true, enrichment is collected and merged. If none are true, basic JSON.

## Test cases

### E2E

1. Click JSON after scan → file downloads with name pattern.
2. Click HTML → file downloads.
3. Click PDF → new window opens with print dialog.
4. Click Copy → button shows "Copied!" for 2s.
5. With test config `enrichment: { domContext: true, cssContext: true }`, JSON nodes include enriched fields.
6. Without enrichment config, JSON nodes do NOT include enriched fields (basic export).
7. After crawl, JSON includes `crawlResults` keyed by URL.
8. After multi-viewport scan, JSON includes per-viewport results.

### Unit

1. `buildJsonReport(state)` returns correct shape.
2. With enrichment off, `report.violations[].nodes[].enriched` is undefined.
3. Filename helper returns ISO date format.
