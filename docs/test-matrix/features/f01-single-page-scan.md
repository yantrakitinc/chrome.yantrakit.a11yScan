# F01 — Single-page scan

## Purpose
Click Scan Page on the active tab → run axe-core + heuristic rules → render violations/passes/incomplete results in the side panel Results sub-tab.

## Source of truth
[F01-single-page-scan.md](../../legacy/features/F01-single-page-scan.md)

## Acceptance criteria

- [ ] Scan button click triggers SCAN_REQUEST → background → content RUN_SCAN → returns SCAN_RESULT
- [ ] State.scanPhase transitions: idle → scanning → results
- [ ] Accordion auto-collapses when scan starts (unless previously in results)
- [ ] Results sub-tab is the active sub-tab when scan completes
- [ ] Violations rendered as <details> with severity-{critical,serious,moderate,minor} classes
- [ ] Each violation shows rule id + impact + WCAG criterion link + node selector + Highlight + Explain Further buttons
- [ ] Passes section collapsed by default (rendered as accordion)
- [ ] WCAG version + level dropdowns control runOnly tags
- [ ] Test config (when loaded) overrides WCAG dropdowns + applies rule include/exclude
- [ ] SCAN_ERROR response shows error card with message
- [ ] Background ARIA scan kicks off after primary scan completes

## Verification mechanism
`e2e/verify-feature-f01-single-page-scan.ts` — load extension, scan a fixture page with known violations, assert each criterion above.

## Structural gaps
- The actual axe-core rule logic is verified by axe-core's own test suite, not ours. Trust boundary.
