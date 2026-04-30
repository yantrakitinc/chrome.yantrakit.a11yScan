# Verification Matrix

Source of truth for which features/interactions/flows have been verified, when, by what mechanism, and current status.

## Legend

- ✅ pass — last verify run succeeded
- ❌ fail — last verify run failed (link to issue)
- ⚠ unverified — never verified, or verification mechanism missing
- 🚧 partial — some assertions verified, structural gap noted

## Features

| ID | Feature | Last verified | Mechanism | Status | Notes |
|---|---|---|---|---|---|
| F01 | Single-page scan | — | — | ⚠ unverified | |
| F02 | Multi-viewport scan | — | — | ⚠ unverified | |
| F03 | Site crawl | — | — | ⚠ unverified | |
| F04 | Observer mode | — | — | ⚠ unverified | |
| F05 | Visual overlays | — | — | ⚠ unverified | |
| F06 | Movie mode | — | — | ⚠ unverified | |
| F07 | CVD filter | — | — | ⚠ unverified | |
| F08 | Element highlight | — | — | ⚠ unverified | |
| F09 | Manual review | — | — | ⚠ unverified | |
| F10 | ARIA validation | 2026-04-29 | `e2e/verify-aria-tab-populated-after-scan.ts` + `e2e/verify-aria-empty-page-state.ts` | ✅ pass (PR #102) | bug fix verified in real Chrome |
| F11 | Heuristic rules | — | — | ⚠ unverified | covered by unit tests only |
| F12 | Enriched context | — | — | ⚠ unverified | |
| F13 | Test config | — | — | ⚠ unverified | |
| F14 | Mock interception | — | — | ⚠ unverified | |
| F15 | Screen reader tab | — | — | ⚠ unverified | |
| F16 | Keyboard tab | — | — | ⚠ unverified | |
| F17 | AI chat | — | — | ⚠ unverified | requires Chrome AI flag |
| F18 | Header / accordion | — | — | ⚠ unverified | |
| F20 | Inspector | — | — | ⚠ unverified | |
| F22 | Clear All | — | — | ⚠ unverified | |

## Interactions

(populated as each interactions/<surface>.md file lands)

| Surface | Last verified | Mechanism | Status |
|---|---|---|---|
| accordion-header | — | — | ⚠ unverified |
| mode-toggles | — | — | ⚠ unverified |
| top-tabs | — | — | ⚠ unverified |
| sub-tabs | — | — | ⚠ unverified |
| scan-button-area | — | — | ⚠ unverified |
| results-tab | — | — | ⚠ unverified |
| manual-tab | — | — | ⚠ unverified |
| aria-tab | 2026-04-29 | `e2e/verify-aria-empty-page-state.ts` | ✅ pass |
| highlight-toolbar | — | — | ⚠ unverified |
| export-action-bar | — | — | ⚠ unverified |
| config-dialog | — | — | ⚠ unverified |
| sr-tab | — | — | ⚠ unverified |
| kb-tab | — | — | ⚠ unverified |
| ai-tab | — | — | ⚠ unverified |
| crawl-config-panel | — | — | ⚠ unverified |
| crawl-results | — | — | ⚠ unverified |
| observer-tab | — | — | ⚠ unverified |
| mv-filter-chips | — | — | ⚠ unverified |
| inspector-tooltip | — | — | ⚠ unverified |
| violation-overlay | — | — | ⚠ unverified |
| tab-order-overlay | — | — | ⚠ unverified |
| focus-gap-overlay | — | — | ⚠ unverified |
| devtools-panel | — | — | ⚠ unverified | structural gap — see structural-gaps.md |

## Flows

| Flow | Last verified | Mechanism | Status |
|---|---|---|---|
| scan-then-aria-tab-populates | 2026-04-29 | `e2e/verify-aria-tab-populated-after-scan.ts` | ✅ pass |
| scan-no-aria-widgets-empty-state | 2026-04-29 | `e2e/verify-aria-empty-page-state.ts` | ✅ pass |
| scan-then-badge-click-jump | — | — | ⚠ unverified |
| observer-auto-scan-on-navigation | — | — | ⚠ unverified |
| crawl-login-page-rule-flow | — | — | ⚠ unverified |
| mv-filter-by-viewport | — | — | ⚠ unverified |
| manual-review-persistence | — | — | ⚠ unverified |
| ai-chat-context-prefill | — | — | ⚠ unverified |
| sr-scope-set-from-inspect | — | — | ⚠ unverified |
| kb-movie-pause-resume-stop | — | — | ⚠ unverified |
| config-upload-then-apply | — | — | ⚠ unverified |
| clear-all-confirmation-flow | — | — | ⚠ unverified |
