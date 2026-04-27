# R-SR — Screen Reader Tab

## Purpose

Show users what a screen reader hears as it walks the page in reading order. Make the invisible (assistive tech announcements) visible. Let users speak any element or play through them all.

## Top of panel

```
[ Analyze ] [⊕ Inspect] [ Clear ]
```

A row at the top of the panel:
- **Analyze** — primary CTA, full-width minus the icons. `class="ds-btn ds-btn--md ds-btn--primary"`. Always enabled.
- **Inspect** (`⊕` crosshair icon) — toggle button. Square 36×36 (larger than minimum because it's primary feature). `aria-label="Inspect element"`, `aria-pressed` reflects state. Active state (when inspect mode is on): amber tint background.
- **Clear** — secondary destructive. `class="ds-btn ds-btn--sm ds-btn--danger"`. Only shown after Analyze has produced results (`state.srAnalyzed === true`).

## Scope indicator (when inspect picks an element)

Below the top row, when `state.srScopeSelector` is set:

```
Scoped to: <nav class="…">                [Clear scope]
```

A blue tinted bar, monospace font for the selector, [Clear scope] button on the right (text-style red).

When scoped: the elements list shows only the reading order WITHIN that subtree. Otherwise: full page.

## Status bar (single inline bar, never appears/disappears)

Below the top row (or the scope indicator if shown), a single status bar:

```
[count or status]                     [▶ Play All]
```

States:

| Mode | Left side (status text) | Right side (controls) | Background tint |
|---|---|---|---|
| Idle | `48 elements in reading order` | ▶ Play All | none (white) |
| Idle, no elements | `Click Analyze to scan the page reading order.` | (no controls) | none |
| Scoped, idle | `5 elements in scope` | ▶ Play All | none |
| Playing (Play All) | `Playing 5 of 48` (amber) | ⏸ Pause + ⏹ Stop | `--ds-amber-50` |
| Paused (Play All) | `Paused at 5 of 48` (amber) | ▶ Resume + ⏹ Stop | `--ds-amber-50` |
| Speaking (single element) | `Speaking element 5` (amber) | ⏸ Pause + ⏹ Stop | `--ds-amber-50` |
| Paused (single element) | `Paused element 5` (amber) | ▶ Resume + ⏹ Stop | `--ds-amber-50` |
| Complete | `Complete` (green) | ▶ Play All | `--ds-green-100` (briefly, 2s, then back to idle) |

ALL controls are icon-only `ds-btn--icon ds-btn--accent` (or `ds-btn--danger` for Stop).

The bar element itself is ALWAYS present in the DOM. Only its content swaps. Background tint changes via class toggle (`.ds-status-bar--active`). NO CSS visibility changes at the container level.

## Elements list

A scrollable region (`flex: 1; overflow-y: auto`) below the status bar.

Each element renders as a row:

```
[index]  [role-badge]   [accessible name]   [source-tag]  [state-badges...]   [🔊]
   2     navigation     Site nav            text                              speaker
```

| Cell | Description |
|---|---|
| index | 1-based index. Monospace, `--ds-zinc-500`. Width 16px, right-aligned. |
| role-badge | The ARIA role. `.ds-badge.ds-badge--role-{role}`. Min-width 50px, centered. |
| accessible name | The computed accessible name. Single line, ellipsis on overflow. Bold (600). |
| source-tag | Where the name came from: `text` (default), `aria-label`, `aria-labelledby`, `alt`, `<label>`, `title`, `sr-only`. `.ds-badge.ds-badge--source`. |
| state-badges | Optional ARIA states ("expanded", "checked", "required", etc.). Multiple `.ds-badge.ds-badge--state`. |
| 🔊 speak | Per-row speak button. `.ds-btn.ds-btn--icon`. `aria-label="Speak: {name}"`. |

Row markup:
```html
<div class="ds-row" role="button" tabindex="0" aria-label="Highlight {role}: {name}" data-selector="…" data-row-index="{i}">
  <span class="ds-row__index">{index}</span>
  <span class="ds-badge ds-badge--role-{role}">{role}</span>
  <span class="ds-row__label">{accessibleName}</span>
  <span class="ds-badge ds-badge--source">{sourceLabel}</span>
  …state badges…
  <button class="ds-btn ds-btn--icon ds-row__speak" aria-label="Speak: {name}" data-row-index="{i}">…</button>
</div>
```

### Row hover

Pure CSS: `.ds-row:hover { background: var(--ds-zinc-50); }`. NO JS hover handler.

### Row active state

`.ds-row.ds-row--active { background: var(--ds-amber-100); }`. The class is toggled programmatically when:
- The row corresponds to `state.srPlayIndex` AND `state.srPlayState !== "idle"` AND `state.srSingleSpeakIndex === null` (Play All current row)
- The row corresponds to `state.srSingleSpeakIndex` (single speak active)
- The row corresponds to `state.srSelectedRowIndex` (recent click, 3-second highlight)

Priority (top wins):
1. Single speak active
2. Play All current
3. Recent click

The class toggle is a TARGETED DOM update — when state changes, only the affected rows have their class added/removed. No full re-render of the list.

## Interactions

### Click row (anywhere except the speak button)

1. Send `HIGHLIGHT_ELEMENT` to content script with the row's `data-selector`. The page element gets a 3s amber glow + scroll into view.
2. Set `state.srSelectedRowIndex = idx`. Toggle the `.ds-row--active` class on this row. Clear it on all other rows.
3. After 3s timeout, clear `state.srSelectedRowIndex` and remove the active class.
4. If user clicks another row before timeout, cancel the previous timeout, reset to the new row.

### Click speak button on a row

1. `e.stopPropagation()` so the row click does not also fire.
2. Cancel any in-progress speech (`speechSynthesis.cancel()`).
3. If element is a CONTAINER role (navigation, banner, contentinfo, complementary, region, article, form, list, group, main):
   - Send `ANALYZE_READING_ORDER` with `scopeSelector: el.selector`.
   - Build speech text as: `"{role}, {name}. {child1.role}, {child1.name}. {child2.role}, {child2.name}. ..."` where children are the scoped result minus the container itself (matched by selector).
4. Else: speech text is `"{role}, {name}{, state1, state2}"`.
5. Set `state.srSingleSpeakIndex = idx` and `state.srPlayState = "playing"`. Toggle the row's `.ds-row--active` class. Toggle the status bar to "Speaking element {idx+1}" + Pause/Stop buttons.
6. Call `speechSynthesis.speak(...)` with an `onend` callback that:
   - If `state.srSingleSpeakIndex === idx` still (speech wasn't superseded): clear `srSingleSpeakIndex`, set `srPlayState = "idle"`, remove active class, restore status bar to idle.

### Pause button (during single speak OR Play All)

1. `speechSynthesis.pause()`
2. `state.srPlayState = "paused"`
3. Update the status bar in place (button → Resume, status text → "Paused …"). NO full re-render.

### Resume button

1. `speechSynthesis.resume()`
2. `state.srPlayState = "playing"`
3. Update the status bar (button → Pause, status text → "Speaking …" or "Playing …").

### Stop button

1. `speechSynthesis.cancel()`
2. Reset all play state: `srPlayState = "idle"`, `srPlayIndex = 0`, `srSingleSpeakIndex = null`.
3. Send `CLEAR_HIGHLIGHTS`.
4. Restore status bar to idle.
5. Remove active class from all rows.

### Play All

1. `state.srPlayState = "playing"`, `srPlayIndex = 0`.
2. Apply active class to row 0.
3. Scroll row 0 into view in the panel.
4. Send `HIGHLIGHT_ELEMENT` for row 0's selector (page glows).
5. Speak row 0's text via `speechSynthesis.speak(...)` with `onend` callback.
6. On end: increment `srPlayIndex`. If `< elements.length`: remove active from old row, add to new, scroll, highlight on page, speak. If `>= elements.length`: call `finishPlayback()`.

`finishPlayback()`:
1. `state.srPlayState = "complete"`.
2. Status bar shows "Complete" green for 2 seconds.
3. After 2s: `srPlayState = "idle"`, `srPlayIndex = 0`. Status bar back to idle.

Speed of Play All / single speak: `state.testConfig?.timing?.movieSpeed ?? 1` is set on each utterance via `utterance.rate`. Speed change during playback does not affect the in-progress utterance — it applies to the next.

### Inspect button

Toggle. When activated:
1. `state.srInspectActive = true`. Apply `--active` class to the button.
2. Send `ENTER_INSPECT_MODE` to content script. The page now shows a hover overlay (blue dashed outline) following the cursor.
3. Wait for `INSPECT_ELEMENT_PICKED` broadcast → set `state.srScopeSelector` to the picked selector. Send `EXIT_INSPECT_MODE`. Set `srInspectActive = false`. Re-fetch reading order with `scopeSelector` and re-render the list.
4. If user clicks Inspect again to deactivate without picking: send `EXIT_INSPECT_MODE`, clear active class.

### Clear button

1. Reset: `srAnalyzed = false`, `srElements = []`, `srScopeSelector = null`.
2. If inspect was active: send `EXIT_INSPECT_MODE`, set `srInspectActive = false`.
3. Stop all playback (call the stop logic).
4. Re-render to "Click Analyze..." empty state.

### Clear scope button (in scope indicator)

1. `state.srScopeSelector = null`.
2. Send `ANALYZE_READING_ORDER` with no scope to refetch full page.
3. Re-render the list.
4. Stop all playback first.

### Escape key

If `srPlayState !== "idle"`: stop playback. (Handled by a single keydown listener at the panel level, not per-row.)

## Empty state

If `srAnalyzed === false`:
- Status bar: "Click Analyze to scan the page reading order."
- Elements list: empty.

If `srAnalyzed === true && srElements.length === 0` (e.g., scoped to a region with no semantic children):
- Status bar: "0 elements in scope" or "0 elements in reading order"
- List: `<div class="ds-empty">No semantic elements found in this scope.</div>`

## Container roles set

```typescript
const CONTAINER_ROLES = new Set([
  "navigation", "banner", "contentinfo", "complementary",
  "region", "article", "form", "list", "group", "main"
]);
```

Used for the container-speak-scoping logic.

## Test config consumption

| Field | Effect |
|---|---|
| `timing.movieSpeed` | Sets the `rate` of `SpeechSynthesisUtterance` for both Play All and single speak. |

No other test config fields are consumed by this tab.

## Accessibility requirements (WCAG 2.2 AA)

1. Each row is keyboard reachable. Tab focuses each row in document order. Enter/Space activates the row click handler.
2. Speak buttons inside rows are also keyboard reachable. Tab order: row → speak button → next row.
3. Focus indicator visible on every focusable element (default `:focus-visible` rule).
4. Status bar updates announce automatically: the bar has `role="status" aria-live="polite" aria-atomic="true"` so playback transitions announce.
5. Source-tag has both visible text AND title attribute for non-mouse users to disambiguate.
6. Speak button aria-label is descriptive: "Speak: {name}".
7. Container speak announces children — matching screen reader natural behavior.
8. Stop key (Escape) is documented in the UI via a `title` on the Stop button: "Stop speech (Esc)".

## Forbidden patterns specific to this tab

1. NO `mouseenter`/`mouseleave` JS handlers on rows. CSS `:hover` only.
2. NO per-row `addEventListener` for click or keydown. Use event delegation on the elements list container.
3. NO full re-render (`panel.innerHTML = ...`) for state changes that affect a single row's class or the status bar's content. Use targeted DOM updates.
4. NO inline `style="background: ..."` for active state. Use the `.ds-row--active` class.

## Test cases

### E2E

1. Click Analyze on a page with a nav landmark → list contains the nav element + its links + headings + text.
2. Click Speak on a non-container row (e.g., a link) → utters "link, Home". No other elements speak.
3. Click Speak on a navigation row containing 4 links → utters "navigation, Site nav. link, Home. link, About. link, Pricing. link, Contact." and then stops.
4. While speaking, click Pause → utterance pauses; status bar shows "Paused element X" + Resume/Stop. Click Resume → continues. Click Stop → cancels, status bar back to idle.
5. Click a row (not the speak button) → page element glows for 3s; row in panel shows amber background for 3s, then clears.
6. Click row #2, immediately click row #5 → row #2's highlight clears, row #5's appears.
7. Click Play All → row 0 highlighted, speech starts. As each element finishes, the next row highlights. After last, "Complete" shown for 2s.
8. During Play All, click Pause → status updates to "Paused at X of Y". Resume → continues from same position. Stop → resets to idle.
9. During Play All, press Escape → playback stops, status idle.
10. Click Inspect → button shows pressed state, content script enters inspect mode (page hover overlay).
11. Click an element on the page during inspect mode → reading order is refetched scoped to that element. Scope indicator shows. Element count updates.
12. Click Clear scope → full reading order returns.
13. Click Clear → list cleared, status returns to "Click Analyze..." empty state.
14. Click Clear during inspect mode → inspect mode exits cleanly.
15. Hover over a row → background changes to `--ds-zinc-50` via CSS hover. Mouse off → background clears. During Play All on that row, hovering does NOT clear the amber highlight.
16. Click Speak on row #2 while row #5 is single-speaking → row #5's speech cancels, row #2 starts.
17. With test config `timing.movieSpeed: 2`, Play All speeds up.

### Unit

1. `getSpeakTextForElement(el)` for non-container returns `"{role}, {name}"`.
2. For container, returns `"{role}, {name}. {child1.role}, {child1.name}. ..."` (mocked sendMessage).
3. `getSpeakTextForElement(el)` returns base text on sendMessage error.
4. State mutator `srStartPlayAll()` sets state correctly.
5. Highlight priority resolver: given (singleSpeakIndex=null, playState="playing", playIndex=3, selectedRowIndex=null), the active row index is 3.
6. Highlight priority resolver: given (singleSpeakIndex=5, playState="playing", playIndex=3), the active row index is 5 (single speak wins).
7. Highlight priority resolver: given (singleSpeakIndex=null, playState="idle", selectedRowIndex=2), the active row index is 2.
8. Highlight priority resolver: given (singleSpeakIndex=null, playState="idle", selectedRowIndex=null), there is no active row.
