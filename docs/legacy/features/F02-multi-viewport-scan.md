# F02 — Multi-Viewport Scan

## Purpose

Scan the page at multiple screen widths (mobile, tablet, desktop) to catch accessibility violations that only appear at certain viewport sizes. Responsive layouts can introduce or hide issues at different breakpoints.

## Who needs it

Developers testing responsive designs, QA validating across devices, auditors needing comprehensive reports.

## Dependencies

- F01 (Single Page Scan) — runs a scan at each viewport width

## Behavior

### Configuration

Multi-Viewport is a **modifier**, not a mode. It applies to whatever scan is happening (single page, crawl, or observer). Toggled via a checkbox labeled "Multi-Viewport" in the accordion form.

**Default viewports**: 375px (mobile), 768px (tablet), 1280px (desktop).

**Viewport editor** (triggered by clicking "edit" next to the viewport chips):
- Each viewport shows as an `<input type="number">` with a × remove button.
- "**+ add**" button: adds a new viewport = max existing + 200, auto-sorted ascending, no duplicates.
- Maximum **6 viewports**. "+ add" is disabled at 6.
- "**done**" button closes the editor.
- Minimum viewport width: 320px. Values below 320 are clamped.

### Scan process (single page)

1. Record the current window width.
2. For each viewport width (ascending order):
   a. Resize the browser window to that width using `chrome.windows.update`.
   b. Wait 500ms for reflow/relayout.
   c. Run axe-core scan (same as F01).
   d. Store results tagged with the viewport width.
3. Restore the original window width.
4. Diff results across viewports:
   - **Shared violations**: violations that appear at ALL viewports.
   - **Viewport-specific violations**: violations that appear at only SOME viewports, tagged with which widths.

### Results display

Same as F01 single page results PLUS:

1. **Multi-Viewport summary banner**: "Multi-Viewport: X shared · Y viewport-specific"
2. **Viewport filter chips**: `All | 375px | 768px | 1280px` — clickable buttons that filter the violation list to a specific width. "All" shows everything.
3. Violations tagged with viewport badges when viewport-specific.

### Breakpoint buckets (for Observer Mode)

When Multi-Viewport + Observer are both active, observer scans are NOT resized. Instead, the current window width is categorized into a **breakpoint bucket** based on the configured viewports.

With viewports [375, 768, 1280], the buckets are:
- 0–375: bucket "≤375px"
- 376–768: bucket "376–768px"
- 769–1280: bucket "769–1280px"
- 1281+: bucket "≥1281px"

Observer results are tagged with their bucket. Viewport chips in observer history let the user filter by bucket.

### Progress during MV scan

Progress bar shows: `viewport 2/3` (current viewport index / total).

### Data structures

```typescript
interface iMultiViewportResult {
  viewports: number[];
  perViewport: Record<number, iScanResult>;  // width → scan result
  shared: iViolation[];                       // violations in ALL viewports
  viewportSpecific: iViewportViolation[];     // violations in SOME viewports
}

interface iViewportViolation extends iViolation {
  viewports: number[];  // which widths this violation appears at
}
```

## Acceptance Criteria

1. Multi-Viewport checkbox toggles MV on/off.
2. Default viewports are 375, 768, 1280.
3. Viewport chips display next to checkbox when MV is on.
4. Clicking "edit" shows the viewport editor with number inputs and × buttons.
5. "**+ add**" adds a new viewport (max + 200, sorted, no duplicates).
6. "**+ add**" is disabled when 6 viewports exist.
7. "**done**" closes the editor.
8. MV scan resizes browser to each width sequentially.
9. Progress shows "viewport X/Y" during MV scan.
10. Results include the MV summary banner.
11. Viewport filter chips appear and filter violations correctly.
12. Shared violations show when "All" is selected.
13. Viewport-specific violations are tagged with width badges.
14. Original window width is restored after scan completes.
15. Viewport editor fits within 360px panel width.
16. Each viewport input and × button meets 24px target size.
