# Verification Matrix

Source of truth for which features/interactions/flows have been verified, when, by what mechanism, and current status.

Last full sweep: 2026-04-29 — all inventories now have a 1:1 verify script in `e2e/`. Scripts run in real Chrome via Puppeteer with the unpacked extension under `dist/`.

## Legend

- ✅ pass — last verify run succeeded on `main`
- ❌ fail — known regression on `main` (sentinel-fail until referenced PR lands)
- 🚧 limited — script ran successfully, but coverage capped by a structural gap (see notes / `structural-gaps.md`)

## Open PRs that gate the matrix

| PR | What it adds | Required for |
|---|---|---|
| #102 | `fix(aria): post-scan zero-widget state` | F01, F10 (Phase B), `flow-scan-no-aria-widgets-empty-state` |
| #113, #115, #117, #119 | interactions verify scripts batches 1–4 | (script files) |
| #120, #121, #122, #123 | features verify scripts batches 1–4 | (script files) |
| #124, #125 | flows verify scripts batches 1–2 | (script files) |
| #126 | this status update | — |

## Features

| ID | Feature | Mechanism | Status |
|---|---|---|---|
| F01 | Single-page scan | `e2e/verify-feature-f01-single-page-scan.ts` (PR #120) | ❌ FAIL on main (PR #102 sentinel) |
| F02 | Multi-viewport scan | `e2e/verify-feature-f02-multi-viewport-scan.ts` (PR #120) | ✅ pass |
| F03 | Site crawl | `e2e/verify-feature-f03-site-crawl.ts` (PR #120) | ✅ pass |
| F04 | Observer mode | `e2e/verify-feature-f04-observer-mode.ts` (PR #120) | 🚧 limited — Observer disabled per `project_observer_broken` memory |
| F05 | Visual overlays | `e2e/verify-feature-f05-visual-overlays.ts` (PR #120) | ✅ pass |
| F06 | Movie mode | `e2e/verify-feature-f06-movie-mode.ts` (PR #121) | 🚧 limited — real TTS unverifiable (Gap 3) |
| F07 | Element highlighting | `e2e/verify-feature-f07-element-highlighting.ts` (PR #121) | ✅ pass — note inventory's "Shadow DOM overlay" is out-of-sync; impl uses inline styles |
| F08 | CVD simulation | `e2e/verify-feature-f08-cvd-simulation.ts` (PR #121) | ✅ pass |
| F09 | Manual review | `e2e/verify-feature-f09-manual-review.ts` (PR #121) | ✅ pass |
| F10 | ARIA validation | `e2e/verify-feature-f10-aria-validation.ts` (PR #121) | ❌ FAIL on main Phase B (PR #102 sentinel) |
| F11 | Heuristic rules | `e2e/verify-feature-f11-heuristic-rules.ts` (PR #122) | ✅ pass |
| F12 | Report export | `e2e/verify-feature-f12-report-export.ts` (PR #122) | ✅ pass |
| F13 | Test configuration | `e2e/verify-feature-f13-test-configuration.ts` (PR #122) | ✅ pass |
| F14 | Mock API | `e2e/verify-feature-f14-mock-api.ts` (PR #122) | ❌ FAIL — known architectural defect: mock-interceptor patches `window.fetch` from isolated world, never reaches page. See script header for the fix path |
| F15 | Screen reader tab | `e2e/verify-feature-f15-screen-reader-tab.ts` (PR #122) | ✅ pass |
| F16 | Keyboard tab | `e2e/verify-feature-f16-keyboard-tab.ts` (PR #123) | ✅ pass |
| F17 | AI chat | `e2e/verify-feature-f17-ai-chat-tab.ts` (PR #123) | 🚧 limited — AI tab disabled by default (Chrome Built-in AI unavailable) |
| F18 | Panel layout | `e2e/verify-feature-f18-panel-layout.ts` (PR #123) | ✅ pass |
| F19 | Phase / Mode system | `e2e/verify-feature-f19-phase-mode-system.ts` (PR #123) | ✅ pass |
| F20 | Accessibility inspector | `e2e/verify-feature-f20-accessibility-inspector.ts` (PR #123) | 🚧 limited — pin-click round-trip racy in Puppeteer; covered by inspector unit tests |
| F22 | Clear All | `e2e/verify-feature-f22-clear-all.ts` (PR #123) | ✅ pass |

## Interactions

| Surface | Mechanism | Status |
|---|---|---|
| top-tabs | `e2e/verify-interaction-top-tabs.ts` (PR #113) | ✅ pass |
| sub-tabs | `e2e/verify-interaction-sub-tabs.ts` (PR #113) | ✅ pass |
| accordion-header | `e2e/verify-interaction-accordion-header.ts` (PR #113) | ✅ pass |
| scan-button-area | `e2e/verify-interaction-scan-button-area.ts` (PR #113) | ✅ pass |
| results-tab | `e2e/verify-interaction-results-tab.ts` (PR #115) | ✅ pass |
| manual-tab | `e2e/verify-interaction-manual-tab.ts` (PR #115) | ✅ pass |
| aria-tab | `e2e/verify-interaction-aria-tab.ts` (PR #115) | ❌ FAIL on main (PR #102 sentinel) |
| highlight-toolbar | `e2e/verify-interaction-highlight-toolbar.ts` (PR #115) | ✅ pass |
| export-action-bar | `e2e/verify-interaction-export-action-bar.ts` (PR #115) | ✅ pass |
| observer-tab | `e2e/verify-interaction-observer-tab.ts` (PR #117) | 🚧 limited — Observer disabled |
| sr-tab | `e2e/verify-interaction-sr-tab.ts` (PR #117) | ✅ pass |
| kb-tab | `e2e/verify-interaction-kb-tab.ts` (PR #117) | ✅ pass |
| ai-tab | `e2e/verify-interaction-ai-tab.ts` (PR #117) | 🚧 limited — AI tab disabled |
| config-dialog | `e2e/verify-interaction-config-dialog.ts` (PR #117) | ✅ pass |
| crawl-config-panel | `e2e/verify-interaction-crawl-config-panel.ts` (PR #119) | ✅ pass |
| crawl-progress | `e2e/verify-interaction-crawl-progress.ts` (PR #119) | ✅ pass |
| devtools-panel | `e2e/verify-interaction-devtools-panel.ts` (PR #119) | 🚧 limited — DevTools panel registration not Puppeteer-driveable (Gap 2) |
| inspector-tooltip | `e2e/verify-interaction-inspector-tooltip.ts` (PR #119) | ✅ pass |
| visual-overlays | `e2e/verify-interaction-visual-overlays.ts` (PR #119) | ✅ pass |

## Flows

| Flow | Mechanism | Status |
|---|---|---|
| scan-then-aria-tab-populates | `e2e/verify-flow-scan-then-aria-tab-populates.ts` (PR #124) | ✅ pass |
| scan-no-aria-widgets-empty-state | `e2e/verify-flow-scan-no-aria-widgets-empty-state.ts` (PR #124) | ❌ FAIL on main (PR #102 sentinel) |
| scan-then-badge-click-jump | `e2e/verify-flow-scan-then-badge-click-jump.ts` (PR #124) | ✅ pass — proves PR #41 closure fix in real Chrome end-to-end |
| clear-all-confirmation-flow | `e2e/verify-flow-clear-all-confirmation-flow.ts` (PR #124) | 🚧 limited — context-menu UI is Chrome-internal |
| manual-review-persistence | `e2e/verify-flow-manual-review-persistence.ts` (PR #124) | ✅ pass |
| mv-filter-by-viewport | `e2e/verify-flow-mv-filter-by-viewport.ts` (PR #125) | ✅ pass |
| sr-scope-set-from-inspect | `e2e/verify-flow-sr-scope-set-from-inspect.ts` (PR #125) | ✅ pass — pin-click excluded (racy) |
| kb-movie-pause-resume-stop | `e2e/verify-flow-kb-movie-pause-resume-stop.ts` (PR #125) | ✅ pass |
| config-upload-then-apply | `e2e/verify-flow-config-upload-then-apply.ts` (PR #125) | ✅ pass — paste path used; file picker non-deterministic in headless |
| observer-auto-scan-on-navigation | `e2e/verify-flow-observer-auto-scan-on-navigation.ts` (PR #125) | 🚧 limited — Observer disabled |
| crawl-login-page-rule-flow | `e2e/verify-flow-crawl-login-page-rule-flow.ts` (PR #125) | 🚧 limited — wait-state UI round-trip needs real crawl engine + multi-route fixture; covered by unit tests |
| ai-chat-context-prefill | `e2e/verify-flow-ai-chat-context-prefill.ts` (PR #125) | 🚧 limited — AI tab disabled |

## Roll-up

| Bucket | ✅ pass | 🚧 limited | ❌ fail |
|---|---|---|---|
| Features (21) | 14 | 4 | 3 |
| Interactions (19) | 14 | 4 | 1 |
| Flows (12) | 7 | 4 | 1 |
| **Total (52)** | **35** | **12** | **5** |

The 5 failures are all sentinel-fails for known issues:
- 4 of them (F01, F10 Phase B, aria-tab, scan-no-aria-widgets-empty-state) all flip to ✅ when **PR #102 (ARIA post-scan zero-widget state)** lands.
- 1 (F14 mock API) is a structural defect — the mock-interceptor patches `window.fetch` from the content-script's isolated world; it cannot reach the inspected page's `window.fetch`. The fix path (re-inject patches into MAIN world) is documented in the F14 verify-script header.

The 12 limited items are gated on out-of-scope work:
- Observer Mode re-enablement (4 — F04, observer-tab interaction, observer-auto-scan-on-navigation flow)
- AI tab enablement (3 — F17, ai-tab interaction, ai-chat-context-prefill flow)
- Real TTS audio (1 — F06)
- DevTools panel registration (1 — devtools-panel interaction)
- Real crawl-engine + multi-route fixture (1 — crawl-login flow)
- Inspector pin-click round-trip (1 — F20)
- Context-menu UI (1 — clear-all-confirmation-flow)

## How to re-run

```sh
pnpm build
npx tsx e2e/verify-<file>.ts
```

A combined runner exists at `e2e/run-verify.ts` (PR #111) and is wired up as `pnpm verify`. That command builds, runs every `e2e/verify-*.ts`, and writes `verify-report.json`.
