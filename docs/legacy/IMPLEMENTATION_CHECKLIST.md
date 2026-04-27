# Implementation Checklist

Every item maps to a feature doc in `/extension/docs/features/`. Check off when: code matches doc, tests pass, verified.

## Extension — Phase 1: Foundation

### F18 — Panel Layout & Navigation
- [ ] Panel renders at 360px minimum width
- [ ] Header: logo + "A11y Scan" + Beta badge + CVD dropdown + pop-out button
- [ ] No gear icon in header
- [ ] 4 top-level tabs with SVG icons above labels (Scan, Screen Reader, Keyboard, AI Chat)
- [ ] Active tab: amber-50 bg + amber-500 bottom border
- [ ] SR and KB tabs disabled during scanning/crawling
- [ ] AI Chat tab never disabled
- [ ] Accordion: debossed/inset style, CSS grid-template-rows animation
- [ ] Accordion: can expand/collapse in ANY phase
- [ ] Accordion: auto-collapse on scan start, auto-expand on Clear
- [ ] Collapsed summary: "WCAG 2.2 AA" + mode tags (color-coded)
- [ ] Collapsed summary: >2 modes shows "N modes" to prevent overflow
- [ ] Toggle bar: WCAG dropdowns + gear + reset + chevron
- [ ] Gear icon next to WCAG dropdowns, NOT in header
- [ ] Reset button clears all modes and config
- [ ] Footer: "A11y Scan beta · Feedback" always visible
- [ ] Focus-visible: 3px amber outline on all interactive elements
- [ ] All text minimum 11px
- [ ] All interactive targets minimum 24×24px
- [ ] All text contrast minimum 4.5:1

### F19 — Phase & Mode System
- [ ] Action button text matches Chart 1 for ALL 10 mode × 5 phase combinations
- [ ] Disabled states match Chart 2 for ALL elements × ALL phases
- [ ] UI section visibility matches Chart 3 for ALL sections × ALL phases
- [ ] Sub-tabs: Results/Manual/ARIA when Observer off; + Observe when Observer on
- [ ] Sub-tabs hidden during Idle and Scanning
- [ ] Modes are independent toggles — any combination works
- [ ] Crawl running suppresses Observer auto-scans
- [ ] Observer auto-scans resume when crawl paused/complete
- [ ] MV applies to whatever scan is happening
- [ ] Movie plays after each scan

## Extension — Phase 2: Core Scanning

### F01 — Single Page Scan
- [ ] SCAN_REQUEST → RUN_SCAN → SCAN_RESULT message flow works
- [ ] WCAG tag mapping correct for all 9 version × level combos
- [ ] Results show summary stats: violations, passes, review, pass rate
- [ ] Violations sorted by severity: critical → serious → moderate → minor
- [ ] Each violation is expandable `<details>` with elements
- [ ] Each element has Highlight button + Explain Further link
- [ ] Passed rules collapsible: "N rules passed"
- [ ] Each passed rule individually expandable with element list
- [ ] Live streaming violations during scan
- [ ] Progress bar during scanning
- [ ] Cancel button stops scan
- [ ] Clear button returns to Idle
- [ ] Error handling: injection fail, timeout, page navigate, tab close, empty page

### F02 — Multi-Viewport Scan
- [ ] MV checkbox toggles mode
- [ ] Default viewports: 375, 768, 1280
- [ ] Viewport editor: number inputs, × remove, + add, max 6, done
- [ ] Scan resizes browser to each width sequentially
- [ ] Progress shows "viewport X/Y"
- [ ] Results show MV summary banner
- [ ] Viewport filter chips (All, 375px, 768px, 1280px)
- [ ] Shared vs viewport-specific violation tagging
- [ ] Original window width restored after scan
- [ ] Breakpoint buckets for Observer + MV combo

### F03 — Site Crawl
- [ ] Crawl mode dropdown: Follow / URL List
- [ ] URL List modal: sitemap load, file upload, manual add, omit/include, done
- [ ] Sitemap XML parser extracts all `<loc>` URLs
- [ ] URL rows use read-only text input (scrollable, not truncated)
- [ ] Follow mode: depth-first traversal, same-origin, respects nofollow
- [ ] Progress bar: page count + current URL
- [ ] Pause/Resume/Cancel buttons
- [ ] Page rules: login/interaction/deferred-content wait types
- [ ] Wait UI: Continue + "Scan page, then continue" + Cancel
- [ ] By page / By WCAG toggle in ALL crawl phases
- [ ] Per-page status: done/active/wait/pending
- [ ] Done pages expandable with violations + MV filter
- [ ] Auth flow: navigate, fill, submit, wait
- [ ] Error handling per page: timeout, non-200, redirect, injection fail
- [ ] Crawl state persists in chrome.storage.local (key: `crawlState`)

### F04 — Observer Mode
- [ ] Toggle enables/disables auto-scanning
- [ ] tabs.onUpdated triggers auto-scan on page load
- [ ] Suppressed during active crawl
- [ ] Resumes when crawl paused/complete
- [ ] Throttle: per-URL minimum seconds between rescans
- [ ] Domain filters: include/exclude with wildcards
- [ ] Manual "Scan This Page" logged in observer history
- [ ] Observe sub-tab: domain filter, export, history list
- [ ] History entries: timestamp, title, URL, violation count
- [ ] Most recent first
- [ ] Max history cap enforced (oldest deleted)
- [ ] Storage keys: `observer_state`, `observer_history`
- [ ] No consent modal — inline help text
- [ ] MV + Observer: breakpoint bucket tagging

## Extension — Phase 3: Visual Tools

### F05 — Visual Overlays
- [ ] Shadow DOM container for all overlays
- [ ] Violation overlay: colored outlines by severity + clickable numbered badges
- [ ] Tab order overlay: numbered badges + connecting SVG lines
- [ ] Focus gap overlay: red dashed outlines + reason tooltips
- [ ] Badge positioning: smart placement, avoid viewport edges
- [ ] High contrast on any background (light or dark pages)
- [ ] Multiple overlay types can be active simultaneously
- [ ] Overlays removed on Clear and new scan
- [ ] Violation badges clickable → scroll to violation in panel
- [ ] Tab/Gaps toggles in Keyboard tab, not Scan tab
- [ ] Violations toggle in Scan tab

### F06 — Movie Mode
- [ ] Toggle enables auto-play after scans
- [ ] Speed dropdown: 0.5×, 1×, 2×, 4× (always enabled)
- [ ] After scan: auto-step through focusable elements
- [ ] Each element: scroll into view, highlight ring, index badge
- [ ] Escape stops playback
- [ ] With Crawl: plays per page before advancing
- [ ] Controls live in Keyboard tab (F16)

### F07 — Element Highlighting
- [ ] Click Highlight → scroll into view + 3s amber glow
- [ ] Works for elements in scrollable containers
- [ ] Fallback for hidden elements (highlight parent)
- [ ] Fallback for removed elements (show message)

### F08 — CVD Simulation
- [ ] Dropdown in header, always accessible
- [ ] 9 options: Normal + 8 simulation types
- [ ] SVG feColorMatrix filter applied to `<html>`
- [ ] Matrices match sidepanel.ts values (9-element arrays)
- [ ] "Normal vision" removes filter
- [ ] Filter persists across scroll
- [ ] Filter removed on page navigation

## Extension — Phase 4: Analysis

### F09 — Manual Review
- [ ] Manual sub-tab visible in Results/Paused/Wait phases
- [ ] 55 criteria (22 partial, 33 manual) from wcag-mapping.ts
- [ ] Filtered by page elements (hasVideo, hasAudio, hasForms, etc.)
- [ ] Each criterion: WCAG ID + name + description + Pass/Fail/N/A buttons
- [ ] Buttons mutually exclusive, click again to deselect
- [ ] Progress counter: "Y of X reviewed"
- [ ] State included in exports
- [ ] State cleared on Clear

### F10 — ARIA Validation
- [ ] 12 widget types detected and validated
- [ ] Results split: Issues first, Compliant below
- [ ] Each widget expandable with check details
- [ ] Highlight on page button per widget
- [ ] Role badges consistent width (min-width)
- [ ] Included in exports

### F11 — Custom Heuristic Rules
- [ ] All 33 rules run after axe-core completes
- [ ] Results merged into main violation list
- [ ] Mapped to correct WCAG criteria
- [ ] Crawl-only rules (21, 22) only during crawl
- [ ] Each rule individually enable/disable via test config
- [ ] Detection algorithms match F11 doc pseudo-code
- [ ] Edge cases handled per doc
- [ ] False positives flagged as "needs review" per doc

## Extension — Phase 5: Export & Config

### F12 — Report Export
- [ ] JSON export: full schema per doc, enriched context when enabled
- [ ] HTML export: self-contained, inline styles, WCAG links
- [ ] PDF export: browser print dialog
- [ ] Copy: JSON to clipboard, "Copied!" confirmation 2s
- [ ] Filename pattern: `A11y-Scan-Report-{domain}-{date}_{time}.{ext}`
- [ ] Manual review + ARIA + crawl + MV data included
- [ ] Export buttons in Scan tab bottom toolbar

### F13 — Test Configuration
- [ ] Paste JSON + Upload .json file
- [ ] Validation with specific error messages
- [ ] Config overrides scan defaults
- [ ] Partial configs work (missing fields use defaults)
- [ ] Config status indicator next to gear
- [ ] Persists in chrome.storage.local

### F14 — Mock API Interception
- [ ] Patches fetch + XMLHttpRequest
- [ ] Matches URL pattern (substring or regex) + optional method
- [ ] Returns configured status + body
- [ ] Non-matching requests pass through
- [ ] Cleaned up on Clear or config change

## Extension — Phase 6: Tabs

### F15 — Screen Reader Tab
- [ ] Analyze button walks DOM in reading order
- [ ] Respects aria-hidden, display:none, aria-owns
- [ ] Each row: accessible name, role badge, states
- [ ] Row height ~30px
- [ ] Click row → highlight element on page
- [ ] Speak button: SpeechSynthesis with pause/resume/stop
- [ ] Visual feedback: quoted SR output in amber when speaking
- [ ] Voices loading: onvoiceschanged retry
- [ ] Play All: auto-step with pause/stop, progress text
- [ ] Inspect button: scope to DOM subtree
- [ ] Scope indicator with Clear scope
- [ ] Rescan clears scope
- [ ] Cleanup: timers + speech on unmount

### F16 — Keyboard Tab
- [ ] Analyze button runs keyboard analysis
- [ ] Tab order list: index, role, name, focus indicator check
- [ ] Click row → highlight element on page
- [ ] Focus gaps: selector + reason
- [ ] Focus indicators: per-element check
- [ ] Keyboard traps: detection + description
- [ ] Skip links: detection + target validity
- [ ] Movie Mode: Play/Pause/Resume/Stop + speed selector
- [ ] Tab order + Focus gaps overlay toggles in bottom toolbar
- [ ] Rescan refreshes all data
- [ ] All sections expandable `<details>`

### F17 — AI Chat Tab
- [ ] Chrome Gemini Nano integration (local, private)
- [ ] "Explain Further" on violations pre-loads context
- [ ] "+ New chat" for freeform questions
- [ ] Message thread: user + AI, alternating styles
- [ ] Chat input fixed at bottom
- [ ] History drawer: slides from right, 20 chat limit
- [ ] Delete single + bulk delete + select all
- [ ] Confirmation before deletion
- [ ] Fallback message when Chrome AI unavailable
- [ ] Storage key: `chatHistory`

## Extension — Phase 7: Infrastructure

### F20 — Accessibility Inspector
- [ ] Inspect button activates hover mode
- [ ] Hover tooltip: role, name, ARIA attrs, tabindex, focus, violations
- [ ] Tooltip positioning: above > below > right > left, 8px margin
- [ ] Click pins tooltip (distinct border), click elsewhere unpins
- [ ] Escape exits inspect mode
- [ ] Top-level frame only (no iframes)
- [ ] Existing overlays remain visible during inspect
- [ ] DevTools sidebar pane via createSidebarPane

### F21 — Pop-out Window
- [ ] Header button expands panel to Math.min(screen.width, 1200)px
- [ ] Button icon toggles: pop-out ↔ collapse
- [ ] aria-label toggles: "Expand panel" ↔ "Collapse panel"
- [ ] State preserved: results, tab, accordion, scroll, config
- [ ] Collapse restores to 360px

### F22 — Context Menu
- [ ] 4 items registered on install: Open Panel, Settings, Chat History, Clear All Data
- [ ] Open Panel: chrome.sidePanel.open(), no-op if already open
- [ ] Settings: open → Scan tab → expand accordion → scroll to gear
- [ ] Chat History: open → AI Chat tab → open history drawer
- [ ] Clear All Data: exact confirmation text, clears all 7 storage keys
- [ ] Post-clear: stateCleared message to reset panel

### F23 — Per-Tab Rescan
- [ ] Scan tab: action button triggers rescan in Results phase
- [ ] Screen Reader tab: Rescan refreshes element tree + clears scope
- [ ] Keyboard tab: Rescan refreshes all analysis
- [ ] Uses current settings without reconfiguration
- [ ] Previous results replaced
- [ ] Observer logs manual rescans

---

## Website — After Extension Complete

### Home Page
- [ ] Feature descriptions match docs for all 23 features
- [ ] Screenshots/mockups reflect actual extension UI
- [ ] No features listed that aren't implemented

### Getting Started Guide
- [ ] Installation steps current
- [ ] First scan walkthrough matches actual UI
- [ ] Mode descriptions match docs
- [ ] Observer Mode section updated
- [ ] Screenshots match actual extension

### Tutorials — Full Rewrite
- [ ] Tutorial: Single page scan (F01)
- [ ] Tutorial: Multi-viewport testing (F02)
- [ ] Tutorial: Site crawl — Follow mode (F03)
- [ ] Tutorial: Site crawl — URL List mode (F03)
- [ ] Tutorial: Observer mode (F04)
- [ ] Tutorial: Visual overlays (F05)
- [ ] Tutorial: Movie mode (F06)
- [ ] Tutorial: Manual review checklist (F09)
- [ ] Tutorial: ARIA validation (F10)
- [ ] Tutorial: Report export (F12)
- [ ] Tutorial: Test configuration (F13)
- [ ] Tutorial: Screen Reader tab (F15)
- [ ] Tutorial: Keyboard tab (F16)
- [ ] Tutorial: AI Chat (F17)
- [ ] Tutorial: Color blindness simulation (F08)
- [ ] Each tutorial: step-by-step with expected outcomes
- [ ] Each tutorial: demo page linked

### Demo Pages
- [ ] All demo pages match current feature set
- [ ] No demo pages reference removed/renamed features
- [ ] Demo pages have intentional violations for testing

### Tutorials Data File
- [ ] `tutorials-data.ts` updated with all new tutorials
- [ ] Tutorial steps match actual extension UI flow
- [ ] No references to old UI patterns
