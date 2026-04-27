# R-PANEL — Side Panel Layout

## Purpose

The container that holds all features. Defines the header, top tabs, tab panels, footer, and modal mount.

## Visual structure

```
┌─────────────────────────────────────────────┐
│ [logo] A11y Scan [BETA]      [CVD select▾] │  ← Header (fixed)
├─────────────────────────────────────────────┤
│  [Scan]  [Screen Reader] [Keyboard] [AI ⌛]│  ← Top tabs (fixed)
├─────────────────────────────────────────────┤
│                                              │
│              ACTIVE TAB CONTENT              │  ← Tab panel (flex:1, scrolls internally)
│                                              │
├─────────────────────────────────────────────┤
│ A11y Scan beta · Feedback                   │  ← Footer (fixed)
└─────────────────────────────────────────────┘

   <dialog>  ← Modal (overlay, only when open)
```

The panel has no fixed width assumption other than "narrow enough to be a Chrome side panel and wide enough to render at ≥600px when expanded."

## Header

A `<header id="header">`.

Left side:
- Logo: `<img src="icons/icon16.png" alt="" width="20" height="20">` (decorative — `alt=""`)
- Brand wordmark: visually `<span class="brand">A11y Scan</span>` aria-hidden, AND a visually hidden `<h1 class="ds-sr-only">A11y Scan — Accessibility audit toolkit</h1>` for the actual heading
- BETA badge: `<span class="ds-badge ds-badge--beta">Beta</span>`

Right side:
- CVD `<select>`: `aria-label="Color vision simulation"` with 9 options (Normal vision + 8 simulations). See R-CVD.

The header is a flex row with `justify-content: space-between`. Background `var(--ds-brand-bg)`, text white.

NO popout button. NO settings button (settings live in the Scan tab accordion's gear).

## Top tabs

Container: `<div role="tablist" aria-label="A11y Scan sections" class="ds-tabs" id="top-tabs">`.

4 tab buttons:

| ID | Label | aria-controls | Initial state |
|---|---|---|---|
| `tab-scan` | Scan | `panel-scan` | `aria-selected="true" tabindex="0"` (active by default) |
| `tab-sr` | Screen Reader | `panel-sr` | `aria-selected="false" tabindex="-1"` |
| `tab-kb` | Keyboard | `panel-kb` | `aria-selected="false" tabindex="-1"` |
| `tab-ai` | AI Chat | `panel-ai` | `aria-selected="false" tabindex="-1" disabled aria-disabled="true"` PLUS a visible "SOON" badge inside the button |

Each tab button has a 16×16 SVG icon (`aria-hidden="true"`) and a text label.

The disabled "AI Chat" tab MUST remain `disabled` permanently — no other code path may flip it back to enabled.

### Keyboard navigation (full ARIA tablist pattern)

Single `keydown` handler on the tablist:
- ArrowRight / ArrowDown → move active tab to next enabled tab (wraps)
- ArrowLeft / ArrowUp → move to previous enabled tab (wraps)
- Home → first enabled tab
- End → last enabled tab

Roving tabindex: only the active tab has `tabindex="0"`; all others have `tabindex="-1"`. Updated on every tab switch.

Activation: clicking or pressing Enter/Space on a focused tab activates it. Activation is automatic on arrow key navigation (active follows focus).

### Tab switch behavior

`switchTab(tabId)`:
1. `state.topTab = tabId`
2. Update `aria-selected` and `tabindex` on each tab
3. Toggle `hidden` and `class="active"` on each tabpanel
4. Persist `state.topTab` to `chrome.storage.session`
5. Call the appropriate `render*Tab()` for the new tab

### Disabled tab behavior

Disabled tabs:
- Are skipped by arrow key navigation
- Cannot be activated
- Show a "SOON" badge

`updateTabDisabledStates()` is called when scan/crawl phase changes:
- During `scanning` or `crawling`, the SR and KB tabs become `disabled` (cannot interrupt a scan by switching contexts)
- AI Chat tab is ALWAYS `disabled` regardless of phase (separate path: `tab-ai` has its own dedicated handling that ignores phase changes)

## Tab panels

Container: `<main class="ds-tabpanels" id="tab-panels">`. The `<main>` element is the primary landmark.

4 panels:

```html
<div role="tabpanel" aria-labelledby="tab-scan" tabindex="0" id="panel-scan" class="ds-tabpanel">…</div>
<div role="tabpanel" aria-labelledby="tab-sr"   tabindex="0" id="panel-sr"   class="ds-tabpanel" hidden>…</div>
<div role="tabpanel" aria-labelledby="tab-kb"   tabindex="0" id="panel-kb"   class="ds-tabpanel" hidden>…</div>
<div role="tabpanel" aria-labelledby="tab-ai"   tabindex="0" id="panel-ai"   class="ds-tabpanel" hidden>…</div>
```

Each panel has `tabindex="0"` so it is focusable for screen reader users.

The `hidden` attribute is the source of truth for which panel is visible. The `.active` class is for CSS only.

### Layout

Each panel is `display: flex; flex-direction: column;` with `min-height: 0` (so children with `flex: 1; overflow-y: auto` can shrink properly). The panel itself is `flex: 1` within the panel container.

## Footer

```html
<footer id="footer">
  A11y Scan <b>beta</b> · <a href="https://a11yscan.yantrakit.com/support" target="_blank" rel="noopener noreferrer">Feedback</a>
</footer>
```

Fixed at the bottom of the side panel. Uses `<footer>` element (implicit `role="contentinfo"`).

## Modal mount

```html
<dialog id="config-dialog" class="ds-modal" aria-labelledby="config-dialog-title">
  <div class="ds-modal__body" id="config-dialog-content"></div>
</dialog>
```

The dialog element is in the HTML once. Its `body` div is populated by `openConfigDialog()` (see R-CONFIG). It opens via `dialog.showModal()`.

## Confirm-clear bar

```html
<div id="confirm-clear-bar" role="alertdialog" aria-labelledby="confirm-clear-text" hidden>
  <p id="confirm-clear-text">…</p>
  <div class="confirm-clear-actions">
    <button id="confirm-clear-yes" class="ds-btn ds-btn--sm ds-btn--danger-fill">Yes, clear all</button>
    <button id="confirm-clear-cancel" class="ds-btn ds-btn--sm ds-btn--secondary">Cancel</button>
  </div>
</div>
```

Sits between the header and the tabs. Hidden by default. Becomes visible when CONFIRM_CLEAR_ALL is triggered. Uses `role="alertdialog"` (NOT plain `role="alert"` — alert regions cannot host interactive children). When shown, focus moves to "Cancel" by default. Escape closes (via JS handler since `<div>` is not a native dialog).

## Flex layout chain

The whole sidepanel is a column flex:

```
body (display: flex; flex-direction: column; height: 100vh; min-height: 0)
├── header (flex-shrink: 0)
├── #confirm-clear-bar (flex-shrink: 0; hidden)
├── #top-tabs (flex-shrink: 0)
├── main#tab-panels (flex: 1; min-height: 0; overflow: hidden)
│   └── .ds-tabpanel (display: flex; flex-direction: column; flex: 1; min-height: 0)
│       └── (panel-specific content; scrollable region inside has flex: 1; overflow-y: auto)
└── footer (flex-shrink: 0)
```

CRITICAL: every flex container in the chain has `min-height: 0` so children with `overflow: auto` can shrink below intrinsic content size. Without it, Chrome will push the toolbar/footer off-screen.

## Resize behavior

Chrome side panel can be resized horizontally. The panel must reflow at ≥320px (lower bound) without horizontal scroll. At ≥600px wide (`@media (min-width: 600px)`), violation rule names and selectors no longer truncate to a single line.

## Test config consumption

This feature does NOT consume test config directly. Sub-features do.

## Test cases

E2E:
1. Sidepanel opens with title "A11y Scan", brand visible, BETA badge visible.
2. Three top tabs are enabled: Scan, Screen Reader, Keyboard. AI Chat tab is disabled with SOON badge.
3. Active tab is "Scan" by default.
4. Clicking another tab switches `aria-selected` and `hidden` on panels.
5. ArrowRight on the active tab moves to the next enabled tab; AI Chat is skipped.
6. ArrowLeft from the first enabled tab wraps to the last enabled tab.
7. Home key activates first enabled tab; End activates last enabled tab.
8. Footer shows "A11y Scan beta · Feedback" link.
9. CVD dropdown has 9 options.
10. After scan starts, SR and KB tabs become disabled. After scan completes, they re-enable. AI Chat remains disabled throughout.

Unit:
1. `switchTab("sr")` → `state.topTab === "sr"`, persists to session storage.
2. `updateTabDisabledStates()` during scanning → sr.disabled and kb.disabled are true; ai.disabled remains true.
3. `updateTabDisabledStates()` during idle → sr.disabled and kb.disabled are false; ai.disabled remains true.
