# F10 — ARIA validation

## Purpose
Detect ARIA widget patterns on the page (tablist, dialog, alertdialog, combobox, slider, menu, menubar, tree, radiogroup, checkbox, switch, accordion) and validate each against WAI-ARIA spec checks.

## Source of truth
[F10-aria-validation.md](../../legacy/features/F10-aria-validation.md)

## Acceptance criteria

- [ ] Background ARIA scan auto-runs after every Scan Page completes
- [ ] State.ariaScanned tracks whether a scan has run for the current scan result
- [ ] Manual "Scan ARIA Patterns" button (run-aria-scan) also triggers scan + sets ariaScanned=true
- [ ] ARIA sub-tab renders 3 distinct states based on ariaWidgets.length + ariaScanned:
  - widgets.length > 0 → render widgets (compliant + issues sections)
  - widgets.length === 0 && !scanned → pre-scan empty state with "Scan ARIA Patterns" button
  - widgets.length === 0 && scanned → "No ARIA widgets detected on this page" (no button)
- [ ] Failing widgets render <details open> by default; passing widgets collapsed
- [ ] Each widget shows: role, label, per-check pass/fail messages, Highlight on page button
- [ ] aria-highlight click sends HIGHLIGHT_ELEMENT for the widget selector
- [ ] State.ariaScanned resets to false at the start of every new Scan Page
- [ ] State.ariaScanned resets to false on Clear (via clearScanResultsSlice)

## Verification mechanism
`e2e/verify-aria-tab-populated-after-scan.ts` (page WITH widgets) + `e2e/verify-aria-empty-page-state.ts` (page WITHOUT widgets) — both run via Puppeteer in real Chrome with unpacked extension.

## Structural gaps
- Pattern detection accuracy is verified for the 12 supported widget patterns; novel ARIA combinations NOT covered.
- Real screen reader announcement of ARIA widgets NOT verified (Gap 3).
