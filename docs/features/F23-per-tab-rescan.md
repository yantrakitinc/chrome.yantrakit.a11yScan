# F23 — Per-Tab Rescan

## Purpose

Pages change — users open modals, expand accordions, navigate SPAs, log in. Rescan refreshes a tab's data with one click without reconfiguring settings.

## Dependencies

- F01, F15, F16 — each provides a Rescan action

## Behavior

### Where rescan exists

Each applicable top-level tab has its own rescan mechanism:

| Tab | Rescan trigger | What it refreshes |
|---|---|---|
| **Scan** | Action button ("Scan Page" / "Scan This Page") | Re-runs axe-core + heuristics + ARIA on current page |
| **Screen Reader** | "Rescan" button | Re-analyzes DOM reading order |
| **Keyboard** | "Rescan" button | Re-analyzes tab order, focus gaps, traps |
| **AI Chat** | N/A | Chat doesn't scan |

### Behavior

- Rescan uses the same settings (WCAG version/level, modes) as the original scan.
- Previous results are replaced, not appended.
- If Observer is on: manual rescan IS logged in observer history.
- Rescan does NOT auto-collapse the accordion (only initial scan does that).

## Acceptance Criteria

1. Scan tab: action button triggers rescan in Results phase.
2. Screen Reader tab: "Rescan" button refreshes the element tree.
3. Keyboard tab: "Rescan" button refreshes keyboard analysis.
4. Rescan uses current settings without requiring reconfiguration.
5. Previous results are replaced by new results.
6. Observer logs manual rescans.
