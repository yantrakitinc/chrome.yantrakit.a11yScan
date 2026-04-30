# F19 — Phase / Mode system

## Purpose
Two state machines: scanPhase (idle → scanning → results) and crawlPhase (idle → crawling → paused → wait → complete). Mode flags (crawl/observer/movie/mv) compose with phase to determine UI: which buttons render, what disabled-ness, what sub-tabs.

## Source of truth
[F19-phase-mode-system.md](../../legacy/features/F19-phase-mode-system.md)

## Acceptance criteria

- [ ] computeActionButtonText(state) returns the correct label given (crawlPhase, scanPhase, observer, crawl, mv) — covered by unit tests
- [ ] When state.crawl=true && crawlPhase=idle: button reads "Start Crawl"
- [ ] When state.mv=true (and not crawling): button reads "Multi-Viewport Scan"
- [ ] When observer=true: button reads "Scan Page" (observer doesn't change label)
- [ ] During scanning: button disabled, scan-progress card visible
- [ ] During crawling: button disabled, crawl-progress card with pause/cancel
- [ ] During wait (page-rule pause): page-rule-wait card visible with continue/scan-then-continue/cancel
- [ ] Sub-tabs render only when scanPhase=results OR crawlPhase ∈ {paused, wait, complete}
- [ ] Toolbar (highlight + export) renders only when scanPhase=results OR crawlPhase ∈ {crawling, paused, wait, complete}
- [ ] Clear button visible when scanPhase=results OR crawlPhase ∈ {paused, wait, complete}

## Verification mechanism
`e2e/verify-feature-f19-phase-mode-system.ts` — drive each state combination via stubbed scan responses; assert visible buttons / disabled-ness / sub-tab presence.

## Structural gaps
- State transitions are deterministic (no async race conditions in computeActionButtonText). Unit tests cover all combinations.
