# Phase × Mode Behavior Chart

Source of truth for UI behavior. The mockup and extension code MUST match these charts.

## Phases (one state, not two)

| Phase | Meaning |
|---|---|
| Idle | Nothing happening. Form visible, empty state or instructions shown. |
| Scanning | Single page scan or crawl in progress. |
| Paused | Crawl paused. Only exists when Crawl mode is on. |
| Wait | Page rule triggered during crawl. Only exists when Crawl mode is on. |
| Results | Scan/crawl complete. Showing results. |

## Chart 1: Action Button Text

| Modes ↓ \ Phase → | Idle | Scanning | Paused | Wait | Results |
|---|---|---|---|---|---|
| None | Scan Page | Scanning… (disabled) | — | — | Scan Page |
| Crawl | Start Crawl | Crawling… (disabled) | Scan Page | — | Scan Page |
| Observer | Scan This Page | Scanning… (disabled) | — | — | Scan This Page |
| Movie | Scan Page | Scanning… (disabled) | — | — | Scan Page |
| MV | Scan Page | Scanning… (disabled) | — | — | Scan Page |
| Crawl + Observer | Start Crawl | Crawling… (disabled) | Scan This Page | — | Scan This Page |
| Crawl + Movie | Start Crawl | Crawling… (disabled) | Scan Page | — | Scan Page |
| Crawl + MV | Start Crawl | Crawling… (disabled) | Scan Page | — | Scan Page |
| Observer + Movie | Scan This Page | Scanning… (disabled) | — | — | Scan This Page |
| Observer + MV | Scan This Page | Scanning… (disabled) | — | — | Scan This Page |
| All modes | Start Crawl | Crawling… (disabled) | Scan This Page | — | Scan This Page |

**Note:** When Crawl is paused AND Observer is on, button says "Scan This Page" — user can manually scan while crawl is paused. When Crawl is paused WITHOUT Observer, the action button is not relevant — user should Resume or Cancel via the progress bar.

## Chart 2: What's Disabled When

| Element | Idle | Scanning/Crawling | Paused | Wait | Results |
|---|---|---|---|---|---|
| Mode toggles (Crawl, Observe, Movie) | ✅ | ❌ | ✅ | ❌ | ✅ |
| WCAG dropdowns | ✅ | ❌ | ✅ | ❌ | ✅ |
| Multi-Viewport checkbox | ✅ | ❌ | ✅ | ❌ | ✅ |
| Gear/Settings | ✅ | ❌ | ✅ | ❌ | ✅ |
| Reset button | ✅ | ❌ | ✅ | ❌ | ✅ |
| Top tabs (Screen Reader, Keyboard) | ✅ | ❌ | ✅ | ❌ | ✅ |
| AI Chat tab | ✅ | ✅ | ✅ | ✅ | ✅ |
| Accordion expand/collapse | ✅ | ✅ | ✅ | ✅ | ✅ |
| Movie speed dropdown | ✅ | ✅ | ✅ | ✅ | ✅ |
| Action button | ✅ | ❌ | ✅ | ❌ | ✅ |

✅ = enabled, ❌ = disabled

## Chart 3: UI Sections Visibility

| Section | Idle | Scanning | Paused | Wait | Results |
|---|---|---|---|---|---|
| Accordion | Expanded | Auto-collapsed (user can expand) | Auto-collapsed (user can expand) | Auto-collapsed | Auto-collapsed (user can expand) |
| Action button | Visible | Visible (disabled) | Visible | Visible (disabled) | Visible |
| Clear button | Hidden | Hidden | Visible | Visible | Visible |
| Progress bar | Hidden | Visible | Visible (stopped) | Hidden | Hidden |
| Pause/Resume + Cancel | Hidden | Visible | Visible | Hidden | Hidden |
| Page rule wait | Hidden | Hidden | Hidden | Visible | Hidden |
| Sub-tabs | Hidden | Hidden | Visible | Visible | Visible |
| Results content | Empty state/instructions | Live streaming violations | Crawl results (so far) | Crawl results (so far) | Full results |
| Bottom toolbar | Hidden | Visible (partial results during crawl, hidden during single scan) | Visible | Visible | Visible |

## Chart 4: Results Content by Mode

Every results view uses the SAME violation row component. Congruent behavior everywhere.

### Single page (no Crawl):
- Summary stats (violations, passes, review, pass rate)
- Violation list sorted by severity (critical → serious → moderate → minor)
- Each violation expandable → shows elements + Highlight + "Explain Further →"
- "X rules passed" expandable → each passed rule shows:
  - Rule ID (e.g., aria-allowed-attr)
  - Human-readable description (e.g., "ARIA attributes must conform to valid values")
  - WCAG criterion + level (e.g., 4.1.2 Name, Role, Value · Level A)
  - Number of elements that passed

### Single page + Multi-Viewport:
- Same as above PLUS viewport filter buttons: All | 375px | 768px | 1280px
- "X shared · Y viewport-specific" summary
- Clicking a viewport filters to violations at that width

### Crawl (with or without MV):
- "By page" / "By WCAG" toggle
- **By page:** Each URL is a `<details>` that expands to show:
  - That page's summary stats
  - That page's violation list (same component as single page)
  - If MV: viewport filter for that page
- **By WCAG:** Violations grouped by criterion across all pages
  - Each criterion expandable → shows which pages + elements
  - Same violation row component

### Manual sub-tab:
- Header: "X criteria need human review" + progress "Y of X reviewed"
- Full list of WCAG criteria that require human judgment
- Each criterion shows: ID, name, description of what to check
- Pass/Fail/N/A toggle per criterion (min 24px target)
- Filtered by page content (video criteria only if page has video, etc.)
- State persists per tab

### ARIA sub-tab:
- Header: "X widgets detected" + "Y issues · Z compliant"
- Split into two sections: "Issues" first, "Compliant" below
- Each widget is expandable (`<details>`):
  - Summary: role badge + label + pass/fail indicator
  - Expanded: list of specific missing/incorrect attributes
  - "Highlight on page" button per widget
- Issues sorted by severity

### Observe sub-tab (only when Observer mode on):
- Domain filter input at top
- Export button (exports history as JSON)
- Full list of auto-scanned pages, each as expandable `<details>`:
  - Summary: timestamp (full, not grouped by day) + page title + violation count
  - Expanded: URL + full timestamp + violation details
- Most recent scans first

### Observer:
- Manual scan results show in Results sub-tab (same as single page)
- Observer auto-scan history shows in Observe sub-tab

### Movie:
- Does not change results content
- Movie plays AFTER scan completes (visual walkthrough on the page, not in the panel)

## Chart 5: Sub-tabs

| Observer mode | Sub-tabs shown |
|---|---|
| Off | Results · Manual · ARIA |
| On | Results · Manual · ARIA · Observe |

Sub-tabs only appear when phase is Paused, Wait, or Results (when there's content to show).

## Chart 6: Crawl Modes

Only 2 crawl modes:
- **Follow** — follows all links from starting page
- **URL List** — curated list. Populated via: paste sitemap URL (Load), upload sitemap file (Upload), or add URLs manually. Opens a modal for URL management. Each URL has Omit/Include toggle. Sitemap is NOT a separate crawl mode — it's a source for populating the URL list.

## Chart 7: Congruency Rules

These patterns MUST be consistent across all views:

1. **Violation rows** — same `<details>` component everywhere: single page results, crawl per-page results, crawl by-WCAG results, live scanning. Same expand behavior, same Highlight button, same "Explain Further →" link.
2. **Bottom toolbar** — same toolbar for single page and crawl results. Export + Highlight. No mode-specific buttons (Movie removed to Keyboard tab).
3. **Viewport filter** — same viewport button row appears in single page results AND inside each crawl page's expanded details when MV is on.
4. **Progress bar** — same component for scanning and crawling. Just different label text.
5. **Expandable rows** — everything that can expand uses `<details>`. Crawl page rows, violation groups, ARIA widgets, observe history entries. Same interaction everywhere.
6. **Action button** — always in the same position. Text changes, never moves. One button, not multiple.
7. **Clear button** — always next to the action button. Same position, same style.

## Chart 8: Additional Rules

- **No redundant status labels.** Progress bars do NOT say "Scanning" or "Crawling" — the action button already shows this. Progress bars only show page count/URL and controls.
- **Gear icon** lives next to WCAG dropdowns in the accordion, NOT in the header.
- **"Scan page, then continue"** is the label for re-scanning current page during page rule wait. NOT "Rescan first."
- **Observer: no consent modal.** Inline help text in the empty state explains that data stays local.
- **Observer + MV:** when both active, observer scans are tagged with which breakpoint bucket the current window width falls into. Viewport chips in the results let the user filter by bucket.

## Chart 9: Accordion Visual & Behavior

- **Debossed/inset style.** The accordion form area has an inset shadow on all sides, making it look sunken into the panel surface. Darker background than the content area.
- **Smooth transition.** Uses CSS `grid-template-rows: 1fr ↔ 0fr` with `transition: 0.2s ease` for smooth height animation. No pop-in/pop-out.
- **Reset button.** Positioned after the gear icon in the WCAG row (expanded state). Resets all modes, MV, crawl config, and URL list to defaults. Disabled when busy.

## Chart 10: Viewport Editor

- **Default viewports:** 375, 768, 1280
- **Each viewport has a × button** to remove it
- **"+ add" button** adds a new viewport (max + 200, auto-sorted ascending, no duplicates)
- **Maximum 6 viewports.** "+ add" disabled at 6.
- **"done" button** closes the editor

## Chart 11: Footer

Always visible at the bottom of the panel. Shows: "A11y Scan **beta** · [Feedback](link to support page)". Compact, one line, text-[11px].

## Chart 12: Collapsed Accordion Summary

Format: `WCAG [version] [level] · [mode tags] ▾`

Examples:
- `WCAG 2.2 AA ▾` (no modes)
- `WCAG 2.2 AA · Crawl ▾`
- `WCAG 2.2 AA · Crawl · Observer ▾`
- `WCAG 2.2 AA · Crawl · Observer · Movie ▾`
- `WCAG 2.2 AA · Crawl · Observer · Movie · Multi-Viewport ▾`

At 360px, the last example will overflow. Solution: when content overflows, truncate mode tags and show count: `WCAG 2.2 AA · 4 modes ▾`
