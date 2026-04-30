# Highlight toolbar (overlays toggle bar)

Renders below sub-tabs when scan results exist. Toggle overlays for violations, tab order, and focus gaps in the inspected page.

| Element | Trigger | Behavior | Visual state | Message |
|---|---|---|---|---|
| `#toggle-violations` | click (off→on) | violationsOverlayOn=true | aria-pressed=true, .active class with amber-100 bg | SHOW_VIOLATION_OVERLAY |
| `#toggle-violations` | click (on→off) | violationsOverlayOn=false | aria-pressed=false, no .active | HIDE_VIOLATION_OVERLAY |
| `#toggle-tab-order` | change (checkbox on) | tabOrderOverlayOn=true | checkbox checked | SHOW_TAB_ORDER |
| `#toggle-tab-order` | change (checkbox off) | tabOrderOverlayOn=false | checkbox unchecked | HIDE_TAB_ORDER |
| `#toggle-focus-gaps` | change (on) | focusGapsOverlayOn=true | checkbox checked | SHOW_FOCUS_GAPS |
| `#toggle-focus-gaps` | change (off) | focusGapsOverlayOn=false | checkbox unchecked | HIDE_FOCUS_GAPS |
| toolbar | render (results phase) | show toolbar above content | toolbar visible | none |
| toolbar | render (idle/scanning) | hide toolbar | toolbar absent | none |

## Source
- Render: `src/sidepanel/scan-tab/render-toolbar.ts`
- Handler: `src/sidepanel/scan-tab/handlers/results-actions.ts` (toggle-violations) + KB-tab handlers for toggle-tab-order + toggle-focus-gaps

## Notes
- State (violationsOverlayOn / tabOrderOverlayOn / focusGapsOverlayOn) survives re-renders so toggles don't drift.
- Hide-all-overlays fires on Scan Page click + Clear (overlays state stale on new page).
- The .active class on toggle-violations was the missing-CSS bug from session 04-27 — fix in PR #16.
