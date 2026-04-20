# F19 — Phase & Mode System

## Purpose

Defines the state machine that governs the entire panel UI. Every button text, every disabled state, every visible section is determined by the current phase and active modes.

## Dependencies

- F18 (Panel Layout) — provides the UI elements this system controls

## Behavior

### Phases

One phase at a time (mutually exclusive):

| Phase | Meaning |
|---|---|
| **Idle** | Nothing happening. Form visible, empty state or instructions shown. |
| **Scanning** | Single page scan or crawl scan in progress. |
| **Paused** | Crawl paused. Only exists when Crawl mode is on. |
| **Wait** | Page rule triggered during crawl. Only exists when Crawl mode is on. |
| **Results** | Scan/crawl complete. Showing results. |

### Modes

Three independent toggles + one modifier. All can be on/off simultaneously.

**Modes:**
- **Crawl** — stateful (idle → running → paused → complete)
- **Observer** — binary on/off, auto-scans pages as user browses
- **Movie** — binary on/off, plays animated tab-order walkthrough after scans

**Modifier:**
- **Multi-Viewport** — applies to whatever scan is happening

### 8 mode combinations

| # | Active | Primary action | Behavior |
|---|---|---|---|
| 1 | None | Scan Page | Single-page scan |
| 2 | Crawl | Start Crawl | Traverse site page by page |
| 3 | Observer | Scan This Page | Auto-scan as user browses |
| 4 | Movie | Scan Page + play | Scan then animate tab order |
| 5 | Crawl + Observer | Start Crawl | Crawl runs; paused → observer takes over |
| 6 | Crawl + Movie | Start Crawl | Each page: scan → play movie → next |
| 7 | Observer + Movie | Scan This Page | Each page: auto-scan → play movie |
| 8 | All three | Start Crawl | Full combo |

Multi-Viewport doubles each combination (applies to the scan step).

### Action button text

Source of truth table — must match exactly:

| Modes ↓ \ Phase → | Idle | Scanning | Paused | Wait | Results |
|---|---|---|---|---|---|
| None | Scan Page | Scanning… (disabled) | — | — | Scan Page |
| Crawl | Start Crawl | Crawling… (disabled) | Scan Page | Crawling… (disabled) | Scan Page |
| Observer | Scan This Page | Scanning… (disabled) | — | — | Scan This Page |
| Movie | Scan Page | Scanning… (disabled) | — | — | Scan Page |
| Crawl + Observer | Start Crawl | Crawling… (disabled) | Scan This Page | Crawling… (disabled) | Scan This Page |
| Crawl + Movie | Start Crawl | Crawling… (disabled) | Scan Page | Crawling… (disabled) | Scan Page |
| Observer + Movie | Scan This Page | Scanning… (disabled) | — | — | Scan This Page |
| All modes | Start Crawl | Crawling… (disabled) | Scan This Page | Crawling… (disabled) | Scan This Page |

**Rule**: When Crawl is paused AND Observer is on, button says "Scan This Page." Without Observer, button in Paused phase follows the default.

### What's disabled when

| Element | Idle | Scanning/Crawling | Paused | Wait | Results |
|---|---|---|---|---|---|
| Mode toggles | ✅ | ❌ | ✅ | ❌ | ✅ |
| WCAG dropdowns | ✅ | ❌ | ✅ | ❌ | ✅ |
| Multi-Viewport checkbox | ✅ | ❌ | ✅ | ❌ | ✅ |
| Gear/Settings | ✅ | ❌ | ✅ | ❌ | ✅ |
| Reset button | ✅ | ❌ | ✅ | ❌ | ✅ |
| Top tabs (SR, KB) | ✅ | ❌ | ✅ | ❌ | ✅ |
| AI Chat tab | ✅ | ✅ | ✅ | ✅ | ✅ |
| Accordion expand/collapse | ✅ | ✅ | ✅ | ✅ | ✅ |
| Movie speed dropdown | ✅ | ✅ | ✅ | ✅ | ✅ |
| Action button | ✅ | ❌ | ✅ | ❌ | ✅ |

### UI section visibility

| Section | Idle | Scanning | Paused | Wait | Results |
|---|---|---|---|---|---|
| Accordion | Expanded | Auto-collapsed | Auto-collapsed | Auto-collapsed | Auto-collapsed |
| Action button | Visible | Visible (disabled) | Visible | Visible (disabled) | Visible |
| Clear button | Hidden | Hidden | Visible | Visible | Visible |
| Progress bar | Hidden | Visible | Visible (stopped) | Hidden | Hidden |
| Pause/Resume + Cancel | Hidden | Visible | Visible | Hidden | Hidden |
| Page rule wait | Hidden | Hidden | Hidden | Visible | Hidden |
| Sub-tabs | Hidden | Hidden | Visible | Visible | Visible |
| Results content | Empty state | Live streaming | Crawl results so far | Crawl results so far | Full results |
| Bottom toolbar | Hidden | Visible during crawl, hidden during single scan | Visible | Visible | Visible |

### Interaction rules

- Modes are independent toggles. Can be changed anytime (except when busy).
- Crawl running suppresses Observer auto-scans. Observer toggle stays on, just dormant.
- Auto-scans resume when crawl pauses, completes, or is cancelled.
- Multi-Viewport applies to whatever scan is happening. Toggle mid-crawl = applies to remaining pages.
- Movie plays after each scan regardless of mode.

### Sub-tabs

| Observer mode | Sub-tabs shown |
|---|---|
| Off | Results · Manual · ARIA |
| On | Results · Manual · ARIA · Observe |

Sub-tabs only appear when phase is Paused, Wait, or Results.

## Acceptance Criteria

1. Action button text matches the chart for every mode × phase combination.
2. Elements are disabled/enabled per the chart for every phase.
3. UI sections are visible/hidden per the chart for every phase.
4. Sub-tabs include "Observe" only when Observer is on.
5. Sub-tabs are hidden during Idle and Scanning phases.
6. Modes can be toggled independently when not busy.
7. Crawl suppresses Observer auto-scans during Crawling phase.
8. Observer auto-scans resume during Paused/Complete phases.
9. Accordion auto-collapses on scan start, auto-expands on Clear.
10. All phase transitions are smooth (no flicker, no missing states).
