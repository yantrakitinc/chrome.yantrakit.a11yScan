# Feature Specifications — A11y Scan Extension

These files are the **source of truth** for the extension. If a behavior is not documented here, it must not be in the extension. If a behavior IS documented here, the extension MUST implement it exactly as specified.

## Rules

1. **Docs first, code second.** Update these specs before writing code. Never the reverse.
2. **One feature per file.** Each file is self-contained. Dependencies are cross-referenced.
3. **Acceptance criteria are tests.** Every criterion maps to at least one unit/integration test.
4. **Edge cases are explicit.** If a scenario isn't covered, it's a doc bug — file it before coding.

## Feature Index

### Core Scanning

| ID | Feature | File | Status |
|---|---|---|---|
| F01 | Single Page Scan | [F01-single-page-scan.md](./F01-single-page-scan.md) | specified |
| F02 | Multi-Viewport Scan | [F02-multi-viewport-scan.md](./F02-multi-viewport-scan.md) | specified |
| F03 | Site Crawl | [F03-site-crawl.md](./F03-site-crawl.md) | specified |
| F04 | Observer Mode | [F04-observer-mode.md](./F04-observer-mode.md) | specified |

### Visual Tools

| ID | Feature | File | Status |
|---|---|---|---|
| F05 | Visual Overlays | [F05-visual-overlays.md](./F05-visual-overlays.md) | specified |
| F06 | Movie Mode | [F06-movie-mode.md](./F06-movie-mode.md) | specified |
| F07 | Element Highlighting | [F07-element-highlighting.md](./F07-element-highlighting.md) | specified |
| F08 | Color Blindness Simulation | [F08-cvd-simulation.md](./F08-cvd-simulation.md) | specified |

### Analysis

| ID | Feature | File | Status |
|---|---|---|---|
| F09 | Manual Review Checklist | [F09-manual-review.md](./F09-manual-review.md) | specified |
| F10 | ARIA Pattern Validation | [F10-aria-validation.md](./F10-aria-validation.md) | specified |
| F11 | Custom Heuristic Rules | [F11-custom-heuristics.md](./F11-custom-heuristics.md) | specified |

### Export & Configuration

| ID | Feature | File | Status |
|---|---|---|---|
| F12 | Report Export | [F12-report-export.md](./F12-report-export.md) | specified |
| F13 | Test Configuration | [F13-test-configuration.md](./F13-test-configuration.md) | specified |
| F14 | Mock API Interception | [F14-mock-api.md](./F14-mock-api.md) | specified |

### Tabs

| ID | Feature | File | Status |
|---|---|---|---|
| F15 | Screen Reader Tab | [F15-screen-reader-tab.md](./F15-screen-reader-tab.md) | specified |
| F16 | Keyboard Tab | [F16-keyboard-tab.md](./F16-keyboard-tab.md) | specified |
| F17 | AI Chat Tab | [F17-ai-chat-tab.md](./F17-ai-chat-tab.md) | specified |

### UI Architecture

| ID | Feature | File | Status |
|---|---|---|---|
| F18 | Panel Layout & Navigation | [F18-panel-layout.md](./F18-panel-layout.md) | specified |
| F19 | Phase & Mode System | [F19-phase-mode-system.md](./F19-phase-mode-system.md) | specified |
| F20 | Accessibility Inspector | [F20-accessibility-inspector.md](./F20-accessibility-inspector.md) | specified |

### Infrastructure

| ID | Feature | File | Status |
|---|---|---|---|
| F21 | Pop-out Window | [F21-pop-out-window.md](./F21-pop-out-window.md) | specified |
| F22 | Context Menu | [F22-context-menu.md](./F22-context-menu.md) | specified |
| F23 | Per-Tab Rescan | [F23-per-tab-rescan.md](./F23-per-tab-rescan.md) | specified |

## Protocol & Data

| Document | Description |
|---|---|
| [MESSAGES.md](./MESSAGES.md) | Complete message protocol — implemented vs planned, storage keys, constants |

## Cross-Cutting Concerns

These are not features but apply to every feature:

| Concern | Reference |
|---|---|
| 360px width constraint | [../UI_MISTAKES_AND_RULES.md](../UI_MISTAKES_AND_RULES.md) |
| Phase × Mode behavior charts | [../PHASE_MODE_CHART.md](../PHASE_MODE_CHART.md) |
| WCAG mapping to axe-core | [../../docs/WCAG-AXE-MAPPING.md](../../../docs/WCAG-AXE-MAPPING.md) |
| Custom heuristic research | [../../docs/BEYOND-AXE-CORE-GAPS.md](../../../docs/BEYOND-AXE-CORE-GAPS.md) |
| The extension itself must pass WCAG 2.2 AA | All features |
