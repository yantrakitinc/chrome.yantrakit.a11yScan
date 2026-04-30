# F16 — Keyboard tab

## Purpose
Render the page's tab order as a list. Show focus gaps (interactive but not focusable). Show focus indicators (per-element :focus paint). Show keyboard traps (Tab cannot move focus away). Show skip-link analysis. Drive Movie Mode from this tab.

## Source of truth
[F16-keyboard-tab.md](../../legacy/features/F16-keyboard-tab.md)

## Acceptance criteria

- [ ] kb-analyze sends GET_TAB_ORDER + GET_FOCUS_GAPS + GET_FOCUS_INDICATORS + GET_KEYBOARD_TRAPS + GET_SKIP_LINKS
- [ ] kb-clear resets state + returns to un-analyzed empty state
- [ ] Tab order rendered as numbered rows with role badge + accessible name + tabindex + focus indicator status
- [ ] Focus gaps section: each gap shows selector + role + reason
- [ ] Focus indicators section: each focusable element + hasIndicator boolean + indicator type (outline/box-shadow/border/background)
- [ ] Keyboard traps section: each trap with selector + description
- [ ] Skip links section: each detected skip-link with target + targetExists status
- [ ] Row click sends HIGHLIGHT_ELEMENT for that selector
- [ ] Movie controls (play/pause/resume/stop) wire up to F06 movie mode
- [ ] Overlay toggles: tab-order + focus-gaps render overlays in inspected page
- [ ] Escape key during movie stops movie mode
- [ ] State.tabOrderOverlayOn + state.focusGapsOverlayOn survive re-render

## Verification mechanism
`e2e/verify-feature-f16-keyboard-tab.ts` — fixture with positive-tabindex sort + focus-gap div + tabindex=-1 button + skip-link; analyze; assert each section.

## Structural gaps
- Native keyboard hardware Tab traversal NOT verified (Gap 4) — synthetic events used.
- Focus-indicator detection uses synthetic .focus() + getComputedStyle diff; real :focus-visible behavior may differ.
