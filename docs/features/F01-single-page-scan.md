# F01 — Single Page Scan

## Purpose

Scan the current browser tab for accessibility violations using axe-core, map results to WCAG criteria, and display them in the side panel. This is the foundational feature — every other scan feature builds on it.

## Who needs it

Every user. Developers fixing violations, QA verifying before release, designers checking renders, auditors generating reports, PMs understanding the a11y state.

## Dependencies

- None (foundational)

## Behavior

### Trigger

User clicks the action button when no modes are active and no crawl is running. Button text: **"Scan Page"**.

### Scan process

1. Side panel sends `SCAN_REQUEST` to background script.
2. Background script injects content script into the active tab (if not already injected).
3. Background script sends `RUN_SCAN` to content script with payload:
   - `wcagVersion`: "2.0" | "2.1" | "2.2"
   - `wcagLevel`: "A" | "AA" | "AAA"
   - `ruleInclude`: string[] (optional, from test config)
   - `ruleExclude`: string[] (optional, from test config)
   - `timeout`: number (ms, default 30000)
4. Content script runs axe-core with the corresponding WCAG tags (e.g., `["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"]` for WCAG 2.2 AA).
5. Content script sends `SCAN_RESULT` back with:
   - `violations`: axe violation objects (rule ID, impact, nodes with selectors)
   - `passes`: axe pass objects (rule ID, nodes)
   - `incomplete`: axe incomplete objects (needs manual review)
   - `pageElements`: detected element types on the page (hasVideo, hasAudio, hasForms, etc.)
6. Background script maps axe results to WCAG criteria using `wcag-mapping.ts`.
7. Background script forwards mapped results to side panel.
8. Side panel renders results.

### WCAG tag mapping

| Version | Level | axe-core tags |
|---|---|---|
| 2.0 | A | `wcag2a` |
| 2.0 | AA | `wcag2a`, `wcag2aa` |
| 2.0 | AAA | `wcag2a`, `wcag2aa`, `wcag2aaa` |
| 2.1 | A | `wcag2a`, `wcag21a` |
| 2.1 | AA | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` |
| 2.1 | AAA | `wcag2a`, `wcag2aa`, `wcag2aaa`, `wcag21a`, `wcag21aa`, `wcag21aaa` |
| 2.2 | A | `wcag2a`, `wcag21a`, `wcag22a` |
| 2.2 | AA | `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`, `wcag22a`, `wcag22aa` |
| 2.2 | AAA | all of the above + `wcag22aaa` |

### Results display

Results appear in the **Results** sub-tab with:

1. **Summary stats row** — 4 values in a grid:
   - Violations (count, red)
   - Passes (count, green)
   - Review (count, amber — incomplete items needing manual check)
   - Pass rate (percentage, neutral)

2. **Violation list** — sorted by severity: critical → serious → moderate → minor.
   Each violation is a `<details>` element:
   - **Summary line**: WCAG criterion + level + severity badge + element count
   - **Expanded content**: one card per affected element showing:
     - CSS selector (monospace)
     - **Highlight** button (scrolls to element on page, see F07)
     - Failure description (what's wrong)
     - **Explain Further →** link (opens AI Chat tab with this violation, see F17)

3. **Passed rules** — a `<details>` element: "✓ N rules passed"
   When expanded, each passed rule is itself a `<details>`:
   - **Summary**: rule ID + WCAG criterion + level + element count
   - **Expanded**: description + list of elements that passed (CSS selectors with green checkmarks)

### Phase transitions

| From | Action | To |
|---|---|---|
| Idle | Click "Scan Page" | Scanning |
| Scanning | Scan completes | Results |
| Scanning | Click Cancel | Idle |
| Results | Click "Scan Page" | Scanning (rescan) |
| Results | Click "Clear" | Idle |

### What changes during scanning

Per PHASE_MODE_CHART.md Chart 2:
- Mode toggles: **disabled**
- WCAG dropdowns: **disabled**
- Multi-Viewport checkbox: **disabled**
- Gear/Settings: **disabled**
- Reset button: **disabled**
- Top tabs (Screen Reader, Keyboard): **disabled**
- AI Chat tab: **enabled** (always)
- Accordion expand/collapse: **enabled** (always)
- Action button: **disabled**, text changes to "Scanning…"

### What's visible during scanning

Per PHASE_MODE_CHART.md Chart 3:
- Accordion: auto-collapsed (user can manually expand)
- Action button: visible, disabled, text "Scanning…"
- Clear button: hidden
- Progress bar: visible
- Sub-tabs: hidden
- Results content: results render immediately when scan completes (axe-core returns all results in one batch; the UI transitions directly from progress to results with no intermediate blank state)
- Bottom toolbar: hidden

### Error handling

| Error | Behavior |
|---|---|
| Content script injection fails | Show error in results area: "Could not scan this page. The page may not allow extensions to run." |
| axe-core timeout (30s default) | Show partial results if any, plus warning: "Scan timed out. Results may be incomplete." |
| Page navigates during scan | Scan is cancelled. Phase returns to Idle. |
| Tab is closed during scan | Scan is cancelled silently. |
| Empty page (no violations, no passes) | Show "No accessibility issues or passes detected. The page may be empty or blocked." |

### Data structures

```typescript
interface iScanResult {
  url: string;
  timestamp: string; // ISO 8601
  wcagVersion: "2.0" | "2.1" | "2.2";
  wcagLevel: "A" | "AA" | "AAA";
  violations: iViolation[];
  passes: iPass[];
  incomplete: iIncomplete[];
  pageElements: iPageElements;
  scanDurationMs: number;
}

interface iViolation {
  ruleId: string;          // axe rule ID, e.g. "color-contrast"
  impact: "critical" | "serious" | "moderate" | "minor";
  description: string;     // human-readable
  helpUrl: string;         // link to axe docs
  wcagCriteria: string[];  // mapped WCAG criterion IDs, e.g. ["1.4.3"]
  nodes: iViolationNode[];
}

interface iViolationNode {
  selector: string;        // CSS selector path
  html: string;            // outerHTML snippet (truncated to 200 chars)
  failureSummary: string;  // what's wrong
}

interface iPass {
  ruleId: string;
  description: string;
  wcagCriteria: string[];
  nodeCount: number;
  nodes: { selector: string; html: string }[];
}

interface iIncomplete {
  ruleId: string;
  description: string;
  wcagCriteria: string[];
  nodes: { selector: string; html: string; message: string }[];
}

interface iPageElements {
  hasVideo: boolean;
  hasAudio: boolean;
  hasForms: boolean;
  hasImages: boolean;
  hasLinks: boolean;
  hasHeadings: boolean;
  hasIframes: boolean;
  hasTables: boolean;
  hasAnimation: boolean;
  hasAutoplay: boolean;
  hasDragDrop: boolean;
  hasTimeLimited: boolean;
}
```

## Acceptance Criteria

1. Clicking "Scan Page" triggers a scan and button changes to "Scanning…" (disabled).
2. Accordion auto-collapses when scan starts.
3. Progress bar appears during scanning.
4. Mode toggles, WCAG dropdowns, gear, reset, and non-AI top tabs are disabled during scanning.
5. AI Chat tab remains accessible during scanning.
6. Accordion can still be expanded/collapsed during scanning.
7. Results render immediately when the scan completes — no blank placeholder state between progress and results.
8. When scan completes, phase transitions to Results.
9. Results show summary stats (violations, passes, review, pass rate).
10. Violations are sorted by severity: critical → serious → moderate → minor.
11. Each violation is expandable to show affected elements.
12. Each element has a Highlight button and Explain Further link.
13. Passed rules are in a collapsible "N rules passed" section.
14. Each passed rule is individually expandable to show passing elements.
15. Clear button appears in Results phase.
16. Clicking Clear returns to Idle with accordion expanded.
17. Sub-tabs (Results/Manual/ARIA) appear in Results phase.
18. Bottom toolbar (Export/Highlight) appears in Results phase.
19. Scan respects selected WCAG version and level.
20. Scan errors display a user-friendly message in the results area.
21. Cancelling a scan returns to Idle.
22. All UI elements remain within 360px width.
23. All text is minimum 11px.
24. All interactive elements are minimum 24×24px target size.
25. All text meets 4.5:1 contrast ratio.
