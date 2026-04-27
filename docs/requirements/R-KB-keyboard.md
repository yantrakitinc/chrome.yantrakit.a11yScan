# R-KB — Keyboard Tab

## Purpose

Comprehensive keyboard navigation audit. Show the tab order, focus gaps, focus indicator status, keyboard traps, skip links, and offer Movie Mode (animated walkthrough of the tab order).

## Top of panel

```
[ Analyze ]                              [ Clear ]
```

- **Analyze** — primary CTA, full-width minus the Clear button. `class="ds-btn ds-btn--md ds-btn--primary"`.
- **Clear** — only shown after Analyze has produced results. `class="ds-btn ds-btn--sm ds-btn--danger"`.

## Sections (after Analyze)

After clicking Analyze, five `<details class="ds-disclosure">` sections appear, in order:

1. Tab Order
2. Focus Gaps
3. Focus Indicators
4. Keyboard Traps
5. Skip Links

Each disclosure has a chevron and is keyboard-operable natively.

### 1. Tab Order section

Open by default.

Summary header:

```
[▼] Tab Order — N elements                              [▶ Play All]
                                                         (or [⏸ Pause] [⏹ Stop] when playing)
```

The Play All / Pause / Resume / Stop controls live INSIDE the summary line. Same icon-only pattern as Screen Reader. Same status text in the same line ("Playing X of Y" / "Paused at X of Y") when active.

When the user clicks the Play All button, the click MUST NOT toggle the disclosure (it is a button inside summary; the button must `e.stopPropagation()` AND the summary must not close on internal clicks). Use a `<div>` summary clickable region only on the label area, not on the buttons. Implementation note: the summary `click` handler checks `e.target.closest("button")` and returns early if so.

Body: a list of `.ds-row` items, one per focusable element:

```
[index]  [role-badge]   [accessible name]                                [target-icon]
   1     a              Skip to content                                  ⊕ green
   2     button         Submit                                           ⊕ red
```

| Cell | Description |
|---|---|
| index | Tab order index (1, 2, 3…). Rendered as a 20×20 dark-indigo circle with white bold number. |
| role-badge | Element role: `a` (link), `button`, `input`, `select`, etc. Same `.ds-badge--role-*` palette as SR. |
| accessible name | Computed accessible name, ellipsis on overflow. |
| target-icon | A 14×14 SVG target/crosshair. Color: `--ds-green-700` if `el.hasFocusIndicator === true`, `--ds-red-700` otherwise. `aria-label="Has visible focus indicator"` or `"Missing visible focus indicator"`. `title` attribute matches. |

Each row is `<div class="ds-row" role="button" tabindex="0" aria-label="Highlight {role}: {name}" data-selector="…" data-row-index="{i}">`. Click highlights the page element and shows row active for 3s (see R-SR for the same pattern; reuse the highlight machinery).

Row active during Movie Mode playback gets `.ds-row--active`.

### 2. Focus Gaps section

Open if `focusGaps.length > 0`, otherwise closed.

Summary: `[▼] Focus Gaps — N elements` in red.

Body: a list of cards (one per gap). Each card is a `.ds-row--card` (a card-style row) showing:

```
[selector in monospace]
[reason: e.g. "div with onclick but no tabindex"]
```

Card is clickable (whole card highlights the page element). `role="button" tabindex="0"`.

Empty state: `<div class="ds-empty">No focus gaps detected.</div>`

### 3. Focus Indicators section

Open if `failedIndicators.length > 0`, otherwise closed.

Summary: `[▼] Focus Indicators — N missing` in amber.

Body: cards for elements lacking a visible focus indicator. Same card pattern as Focus Gaps but amber color.

Empty state: `<div class="ds-empty ds-empty--success">All focusable elements have visible focus indicators.</div>`

### 4. Keyboard Traps section

Open if `keyboardTraps.length > 0`, otherwise closed.

Summary: `[▼] Keyboard Traps — N` in red.

Body: cards. Each shows the trap selector and a description (e.g. "Tab does not move focus away from this modal").

Empty state: `<div class="ds-empty ds-empty--success">No keyboard traps detected.</div>`

### 5. Skip Links section

Closed by default.

Summary: `[▼] Skip Links — N` in blue.

Body: list of detected skip links. For each: target selector, where it points, whether the target exists.

Empty state: `<div class="ds-empty">No skip links detected.</div>`

## Highlight overlay toggles (bottom toolbar within panel)

Below the sections, fixed at bottom:

```
Highlight    [☑ Tab order]    [☐ Focus gaps]
```

A `.ds-toolbar__row` with two checkbox-labels (using native `<input type="checkbox">` inside `<label>`).

When toggled:
- **Tab order** ☑ → send `SHOW_TAB_ORDER` to content script. ☐ → send `HIDE_TAB_ORDER`.
- **Focus gaps** ☑ → send `SHOW_FOCUS_GAPS`. ☐ → send `HIDE_FOCUS_GAPS`.

Checkbox state mirrors `state.kbTabOrderOverlayOn` and `state.kbFocusGapsOverlayOn`.

## Movie Mode

Lives at the top of the Tab Order section header (see "Tab Order section" above). NO separate Movie Mode section. NO speed dropdown in UI. Speed is configured via `state.testConfig.timing.movieSpeed`.

State machine: `state.kbMoviePlayState: "idle" | "playing" | "paused" | "complete"` and `state.kbMovieIndex: number`.

### Idle → Playing (user clicks Play All)

1. `state.kbMoviePlayState = "playing"`, `state.kbMovieIndex = 0`.
2. Send `SET_MOVIE_SPEED` with `state.testConfig?.timing?.movieSpeed ?? 1`.
3. Send `START_MOVIE_MODE`.
4. The content script begins focusing each tabbable element with a delay determined by speed (1 element per second at speed 1).
5. Content script broadcasts `MOVIE_MODE_STEP { index, total }` per step. Sidepanel updates `state.kbMovieIndex` and toggles the active class on the corresponding row (targeted DOM update, not full re-render). Status text in the summary updates to "Playing {index+1} of {total}".

### Playing → Paused (user clicks Pause)

1. Send `PAUSE_MOVIE_MODE`. Content script pauses (stays focused on current element).
2. `state.kbMoviePlayState = "paused"`. Status text → "Paused at X of Y". Summary controls switch to Resume + Stop.

### Paused → Playing (user clicks Resume)

1. Send `RESUME_MOVIE_MODE` (NOT `START_MOVIE_MODE`).
2. `state.kbMoviePlayState = "playing"`. Status text → "Playing".

### Stop (user clicks Stop)

1. Send `STOP_MOVIE_MODE`. Content script removes any visual highlight from the page element.
2. `state.kbMoviePlayState = "idle"`, `kbMovieIndex = 0`. Active class cleared from all rows. Summary controls back to Play All.

### Complete (last element finished)

Content script broadcasts `MOVIE_MODE_COMPLETE`.

1. `state.kbMoviePlayState = "complete"`. Status text → "Complete" (green) for 2 seconds. After 2s, returns to idle.

### Escape key

If `kbMoviePlayState !== "idle"`, Escape stops Movie Mode (same as clicking Stop). Single keydown listener at panel level.

## Empty state

Before Analyze: `<div class="ds-empty">Click Analyze to scan keyboard navigation.</div>`

After Clear: same empty state.

## Test config consumption

| Field | Effect |
|---|---|
| `timing.movieSpeed` | Movie Mode playback speed (multiplier). Default 1. |

## Accessibility requirements

1. Every row keyboard reachable, target icon explained via aria-label.
2. Movie Mode controls inside summary line have `aria-label` and `e.stopPropagation()` to avoid toggling the disclosure on click.
3. Status text inside the summary has `aria-live="polite"` so playback transitions announce.
4. Highlight checkboxes have proper `<label>` association.
5. Tab Order section auto-focuses the Play All button after Analyze (so keyboard users don't have to tab through the disclosure to reach it).
6. The 24×24 minimum target size applies to the index circles (decorative — they are NOT interactive, so 20×20 is acceptable).

## Forbidden patterns specific to this tab

1. NO Movie Mode in a separate section/page.
2. NO speed dropdown in the UI.
3. NO `addEventListener("mouseenter"/"mouseleave")` for row hover. CSS only.
4. NO full re-render of the entire tab during Movie Mode steps. Targeted class toggle only.

## Test cases

### E2E

1. Click Analyze on a page with 15 tabbable elements → Tab Order section shows 15 rows. Focus Gaps may show some entries. Focus Indicators may show some failures.
2. Click Play All → first row highlights amber, page element gets focus, after 1s second row highlights, etc. Status text updates each step.
3. Click Pause during Movie Mode → status shows "Paused at X of Y", page element retains focus.
4. Click Resume → continues from where it paused.
5. Click Stop → resets to idle, page focus cleared.
6. Press Escape during Movie Mode → stops.
7. Toggle "Tab order" checkbox in highlight toolbar → page shows numbered overlay badges.
8. Toggle "Focus gaps" checkbox → page shows red dashed outlines.
9. Click a Tab Order row → page element gets 3s amber glow + scroll into view; row in panel highlights for 3s.
10. Click a Focus Gap card → same highlight behavior on the gap element.
11. With test config `timing.movieSpeed: 2`, Movie Mode runs at 2× speed.
12. Click Clear → all sections clear, return to "Click Analyze" empty state. If Movie Mode was playing, it stops.

### Unit

1. `state.kbMoviePlayState` transitions: idle → playing → paused → playing → idle (via stop).
2. Movie Mode complete transition triggers a 2s "Complete" status before idle.
3. Active row class toggle: `kbMovieIndex` changes from 3 to 4 → row 3 loses class, row 4 gains. Other rows untouched.
4. `MOVIE_MODE_STEP` message handler updates `state.kbMovieIndex` and the DOM correctly.
