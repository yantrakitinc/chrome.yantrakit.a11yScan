# F12 — Report Export

## Purpose

Export scan results in three formats: JSON (for AI tools and CI), HTML (shareable), PDF (for formal reports). Plus clipboard copy for quick sharing.

## Dependencies

- F01 (Single Page Scan) — provides results to export
- F09 (Manual Review) — manual review state included in exports
- F10 (ARIA Validation) — ARIA results included in exports

## Behavior

### Export buttons

Located in the bottom toolbar, under "Export" label:
- **JSON** button
- **HTML** button
- **PDF** button
- **Copy** button (accent style — copies JSON to clipboard)

### JSON format

Enriched, machine-readable format designed for AI agents and CI pipelines.

```typescript
interface iJsonReport {
  metadata: {
    url: string;
    title: string;
    timestamp: string;        // ISO 8601
    wcagVersion: string;
    wcagLevel: string;
    toolVersion: string;
    scanDurationMs: number;
  };
  summary: {
    violationCount: number;
    passCount: number;
    incompleteCount: number;
    passRate: number;         // percentage
  };
  violations: iViolation[];
  passes: iPass[];
  incomplete: iIncomplete[];
  manualReview?: {            // if manual review was done
    reviewed: number;
    total: number;
    criteria: { id: string; name: string; status: "pass" | "fail" | "na" | null }[];
  };
  ariaWidgets?: iAriaWidget[];
  tabOrder?: { index: number; selector: string; role: string; name: string }[];
  focusGaps?: { selector: string; reason: string }[];
  enrichedContext?: Record<string, iEnrichedContext>;  // selector → context
  crawl?: {                   // if site crawl
    pagesScanned: number;
    pagesFailed: number;
    results: Record<string, iScanResult>;
  };
  viewportAnalysis?: iMultiViewportResult;
}
```

When enriched context is enabled (via test config), each violation node includes:
- **DOM context**: parent selector, sibling selectors (up to 5), nearest landmark, nearest heading
- **CSS context**: computed color, backgroundColor, fontSize, display, visibility, position
- **Framework hints**: detected framework, component name, test ID
- **File path guesses**: inferred from class names, data attributes, IDs

### HTML format

Self-contained HTML file with inline styles. No external dependencies.

Sections:
1. Report header: page URL, scan date, WCAG version/level
2. Summary statistics
3. Violations grouped by WCAG criterion, color-coded by severity
4. Passes (collapsible)
5. Manual review results (if applicable)
6. ARIA validation results (if applicable)

Links to WCAG criteria point to `a11yscan.yantrakit.com/wcag/[criterion-id]`.

### PDF format

Generated client-side via browser print dialog applied to the HTML report.
- Print-friendly layout with page breaks at logical boundaries.
- Includes all violation details and manual review state.
- Headers and footers on each page.

### Copy to clipboard

Copies the JSON export content to clipboard. No popup, no modal.
- Button text briefly changes to "Copied!" for 2 seconds, then reverts.
- Uses `navigator.clipboard.writeText()`.

### Filename pattern

`A11y-Scan-Report-{domain}-{date}_{time}.{ext}`

Example: `A11y-Scan-Report-example-com-2025-04-19_14-32.json`

### When available

Bottom toolbar (with Export buttons) is visible when:
- Single page scan: Results phase only
- Crawl: Crawling (partial), Paused, Wait, Complete phases

## Acceptance Criteria

1. JSON export contains all scan data in documented format.
2. HTML export is self-contained with inline styles.
3. PDF export triggers browser print dialog.
4. Copy button copies JSON to clipboard.
5. Copy button shows "Copied!" confirmation for 2 seconds.
6. Filename follows the documented pattern.
7. Enriched context is included when enabled.
8. Manual review state is included in all export formats.
9. ARIA validation results are included.
10. Crawl exports include per-page results.
11. Multi-viewport exports include viewport analysis.
12. Export buttons fit on one row within 360px panel.
13. Each export button meets 24px target size.
