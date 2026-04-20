# F16 — Keyboard Tab

## Purpose

A top-level tab for comprehensive keyboard navigation audit. Shows tab order, focus gaps, focus indicators, keyboard traps, skip links, and Movie Mode controls.

## Dependencies

- F06 (Movie Mode) — play controls live here
- F05 (Visual Overlays) — tab order and focus gap overlays

## Behavior

### Tab location

Third top-level tab: Scan | Screen Reader | **Keyboard** | AI Chat.

Disabled when a scan/crawl is actively running. Always accessible otherwise.

### Initial state

Button: "**Analyze**" — runs the keyboard analysis on the current page.

### Analysis sections

After analysis, the tab shows these sections (each expandable):

#### 1. Tab order list

Every focusable element in keyboard navigation sequence:
- **Index**: sequential number (1, 2, 3…)
- **Selector**: CSS selector (monospace, truncated)
- **Role**: element role (button, link, input, etc.)
- **Accessible name**: computed name
- **Focus visible**: ✓ if element has visible `:focus` styles, ✗ if not

**Row interaction**: each row is **clickable** — clicking highlights the element on the page (F07: scroll into view + 3-second amber glow). Rows have hover state (background change) and pointer cursor.

#### 2. Focus gaps

Interactive elements that can't be reached by keyboard:
- **Selector**: CSS selector
- **Reason**: why it's unreachable (e.g., "div with onclick but no tabindex", "aria-hidden ancestor", "display:none")

#### 3. Focus indicators

Per-element check for visible `:focus` styles:
- Compares computed styles on `:focus` vs unfocused state.
- Elements with `outline: none` and no replacement indicator are flagged.

#### 4. Keyboard traps

Elements where focus gets stuck (Tab does not move focus away):
- Detected by simulating Tab key and checking if focus moves.
- Each trap shows the selector and what it traps on.

#### 5. Skip links

Whether the page has skip navigation:
- Detects `<a href="#main-content">Skip to main content</a>` patterns.
- Shows where the skip link points.
- Flags if skip link target doesn't exist.

#### 6. Movie Mode controls

Play button that starts the animated tab order walkthrough (F06):
- **Play / Pause / Stop** controls
- **Speed selector** (0.5×, 1×, 2×, 4×)
- **Progress**: "Element X of Y"

This is Movie Mode's natural home — the Keyboard tab.

### Overlay toggles

The Keyboard tab owns the **Tab order** and **Focus gaps** page overlays. These toggles live in a bottom toolbar within the Keyboard tab — NOT in the Scan tab.

| Toggle | What it shows on the page |
|---|---|
| **Tab order** | Numbered badges on every focusable element + connecting lines showing navigation sequence |
| **Focus gaps** | Red dashed outlines on interactive elements that can't be reached by keyboard |

The Scan tab's bottom toolbar only has **Violations** overlay. Tab and Gaps moved here because they are keyboard navigation features.

### Rescan

Button refreshes all keyboard data when the page changes.

### Data structures

```typescript
interface iKeyboardAnalysis {
  tabOrder: iTabOrderElement[];
  focusGaps: iFocusGap[];
  focusIndicators: iFocusIndicator[];
  keyboardTraps: iKeyboardTrap[];
  skipLinks: iSkipLink[];
}

interface iTabOrderElement {
  index: number;
  selector: string;
  role: string;
  accessibleName: string;
  tabindex: number | null;
  hasFocusIndicator: boolean;
}

interface iFocusGap {
  selector: string;
  role: string;
  reason: string;
}

interface iFocusIndicator {
  selector: string;
  hasIndicator: boolean;
  indicatorType?: string;  // "outline", "box-shadow", "border", "background"
}

interface iKeyboardTrap {
  selector: string;
  description: string;
}

interface iSkipLink {
  selector: string;
  target: string;
  targetExists: boolean;
}
```

## Acceptance Criteria

1. Keyboard tab is a top-level tab with its own vertical space.
2. "Analyze" button runs the keyboard analysis.
3. Tab order list shows all focusable elements in correct sequence.
4. Clicking a tab order row highlights the element on the page (scroll + 3s amber glow).
5. Tab order rows have hover state and pointer cursor.
6. Focus gaps show interactive elements unreachable by keyboard with reasons.
7. Focus indicator check identifies elements without visible focus styles.
8. Keyboard trap detection identifies trapped focus.
9. Skip link detection identifies skip navigation presence and validity.
10. Movie Mode play controls work (play, pause, stop, speed).
11. Rescan button refreshes all data.
12. Tab is disabled during scanning/crawling.
13. All sections are expandable `<details>`.
14. Tab order and Focus gaps overlay toggles are in the Keyboard tab toolbar, not the Scan tab.
15. Toggling Tab order overlay shows numbered badges + connecting lines on the page.
16. Toggling Focus gaps overlay shows red dashed outlines on unreachable elements.
17. All UI fits within 360px.
