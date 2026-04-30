# F11 — Heuristic rules (33 custom rules)

## Purpose
33 custom DOM/CSS heuristic rules that catch what axe-core misses. Run alongside axe scans; results merged into the violations list with `id: "heuristic-<rule-id>"`.

## Source of truth
[F11-custom-heuristics.md](../../legacy/features/F11-custom-heuristics.md)

## Acceptance criteria

- [ ] runHeuristicRules(isCrawl, excludeRules?) returns iViolation[] alongside axe violations
- [ ] Rule numbers excluded via the `exclude` array are skipped
- [ ] Cross-page rules (21, 22) only run when isCrawl=true
- [ ] Reflow at 320px rule (29) only runs when window.innerWidth ≤ 320
- [ ] Rule outputs merged into state.lastScanResult.violations after axe completes
- [ ] Each heuristic violation has `id: "heuristic-<id>"`, impact, description, help, helpUrl, tags, nodes, wcagCriteria
- [ ] Empty results (rule fired but found nothing) filtered out before merging
- [ ] Per-rule counts visible in JSON export under `heuristicViolations`

## Verification mechanism
`e2e/verify-feature-f11-heuristic-rules.ts` — fixture page that triggers each rule (decorative symbols, icon fonts, generic links, small touch targets, etc.); assert each fires.

## Structural gaps
- Some rules use mocked getBoundingClientRect in unit tests because jsdom returns 0×0; production behavior with real layout NOT directly unit-tested.
- Rule 5 (visual-DOM order) requires real flex/grid layout — Puppeteer harness uses fixture HTML with explicit positioning to verify.
