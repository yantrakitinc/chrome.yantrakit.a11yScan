# 01 — Design Tokens

## Purpose

Single source of design values used by the entire sidepanel. All colors, spacing, typography, and z-indexes referenced in code MUST come from this list as CSS custom properties (defined on `:root` in `sidepanel.css`). No hardcoded color literals in any TS file.

## Color tokens

### Brand
- `--ds-brand-bg`: `#080720` — header background (deep navy)
- `--ds-brand-fg`: `#ffffff` — header text on brand bg
- `--ds-brand-fg-muted`: `rgba(255,255,255,0.6)` — secondary header text

### Amber (primary accent — CTA, active states, scan/play highlights)
- `--ds-amber-50`: `#fffbeb` — lightest amber tint (toolbar background during play, hover backgrounds)
- `--ds-amber-100`: `#fef3c7` — soft tint (active-row highlight, "Config loaded" badge bg, mode-active bg)
- `--ds-amber-200`: `#fde68a` — soft border (info banners)
- `--ds-amber-300`: `#fcd34d` — secondary border (Play/Pause button borders, "Config loaded" badge border)
- `--ds-amber-500`: `#f59e0b` — primary CTA fill ("Scan Page", "Apply" button background)
- `--ds-amber-600`: `#d97706` — settings-button active text, MV filter chip border, viewport done-button border, mv-check accent
- `--ds-amber-700`: `#b45309` — secondary text/icon ("Play All" icon, footer brand mark)
- `--ds-amber-800`: `#92400e` — emphasized text in amber regions (active tab text, status during playback)
- `--ds-amber-900`: `#78350f` — strongest amber text (active tab label)
- `--ds-amber-cta-fg`: `#1a1000` — text on `--ds-amber-500` background

### Red (destructive, errors, critical violations)
- `--ds-red-50`: `#fef2f2` — error region background
- `--ds-red-200`: `#fecaca` — destructive button border ("Reset", "Stop", "Clear", "Cancel")
- `--ds-red-600`: `#dc2626` — destructive text and icon color
- `--ds-red-700`: `#b91c1c` — emphasized destructive text (error messages)
- `--ds-red-800`: `#991b1b` — severity:critical body text in HTML report header
- `--ds-red-900`: `#7f1d1d` — strongest red text

### Green (success, passes)
- `--ds-green-50`: `#ecfdf5` — pass region background
- `--ds-green-100`: `#d1fae5` — pass card tint
- `--ds-green-200`: `#a7f3d0` — pass border
- `--ds-green-700`: `#047857` — pass text/icon color
- `--ds-green-900`: `#064e3b` — strongest green text

### Blue / Sky / Indigo (links, info, banners, navigation)
- `--ds-blue-50`: `#f0f9ff` — info banner bg
- `--ds-blue-100`: `#e0f2fe` — link role badge bg
- `--ds-blue-700`: `#075985` — link role badge text
- `--ds-sky-200`: `#bae6fd` — Skip Links 'target exists' card border
- `--ds-sky-400`: `#38bdf8` — Skip Links chevron icon
- `--ds-sky-700`: `#0369a1` — Skip Links section title, valid skip-link target text
- `--ds-sky-900`: `#0c4a6e` — Crawl mode badge text
- `--ds-indigo-700`: `#4338ca` — interactive link color (Open Builder, WCAG ref, "explain" button)
- `--ds-indigo-900`: `#1e1b4b` — tab order badge background, deep-indigo accents
- `--ds-indigo-950`: `#080720` — same as `--ds-brand-bg`

### Violet (Movie Mode badge)
- `--ds-violet-100`: `#ede9fe` — Movie mode badge bg
- `--ds-violet-400`: `#a78bfa` — accent
- `--ds-violet-900`: `#4c1d95` — Movie mode badge text

### Emerald (alternate green accents — Observer mode badge)
- `--ds-emerald-100`: `#d1fae5` — Observer mode badge bg
- `--ds-emerald-400`: `#34d399` — accent
- `--ds-emerald-600`: `#059669` — checkmark stroke

### Yellow (page-rule wait accent)
- `--ds-yellow-400`: `#fbbf24` — page-rule wait UI border

### Zinc (neutral surfaces and text)
- `--ds-zinc-50`: `#fafafa` — hover row background
- `--ds-zinc-100`: `#f4f4f5` — secondary surface, divider track
- `--ds-zinc-200`: `#e4e4e7` — border
- `--ds-zinc-300`: `#d4d4d8` — input border, secondary button border
- `--ds-zinc-400`: `#a1a1aa` — disabled text, NEVER for active text on zinc-100 (insufficient contrast)
- `--ds-zinc-500`: `#71717a` — secondary text (timestamps, metadata)
- `--ds-zinc-600`: `#52525b` — body secondary text
- `--ds-zinc-700`: `#3f3f46` — body primary text on white
- `--ds-zinc-800`: `#27272a` — strong text
- `--ds-zinc-900`: `#18181b` — heading

### Severity (axe-core impact levels)
- `--ds-sev-critical`: `var(--ds-red-700)` — critical violation accent
- `--ds-sev-serious`: `#f97316` (orange-500) — serious violation accent
- `--ds-sev-moderate`: `#eab308` (yellow-500) — moderate violation accent
- `--ds-sev-minor`: `#3b82f6` (blue-500) — minor violation accent

### Role badge colors (Screen Reader and Keyboard tab role badges)
- Link: bg `var(--ds-blue-100)`, fg `var(--ds-blue-700)`
- Button: bg `#ede9fe`, fg `#5b21b6`
- Heading: bg `var(--ds-amber-100)`, fg `var(--ds-amber-800)`
- Img: bg `#fce7f3`, fg `#9d174d`
- Textbox: bg `var(--ds-green-100)`, fg `var(--ds-green-900)`
- Navigation/Banner/Contentinfo: bg `#e0e7ff`, fg `#3730a3`
- Default (other roles): bg `var(--ds-zinc-100)`, fg `var(--ds-zinc-700)`

## Spacing scale

CSS pixels. Use as `padding`, `margin`, `gap`. Encoded as `--ds-space-N`.

| Token | Value | Use |
|---|---|---|
| `--ds-space-1` | `2px` | tight insets, vertical micro-padding |
| `--ds-space-2` | `4px` | small gap, badge padding |
| `--ds-space-3` | `6px` | row padding-vertical |
| `--ds-space-4` | `8px` | standard gap, button padding-vertical |
| `--ds-space-5` | `10px` | button padding-horizontal |
| `--ds-space-6` | `12px` | row padding-horizontal, card padding |
| `--ds-space-8` | `16px` | section padding |
| `--ds-space-10` | `20px` | section gap |
| `--ds-space-12` | `24px` | minimum touch target |

## Typography

Use system font stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.

Monospace stack: `"SFMono-Regular", Consolas, "Liberation Mono", monospace`.

| Token | Size | Weight | Line height | Use |
|---|---|---|---|---|
| `--ds-text-xs` | `9px` | 600 | 1.4 | Source-tag badge (Screen Reader tab) — tiny meta |
| `--ds-text-sm` | `10px` | 700 | 1.4 | "SOON" badge, micro-status |
| `--ds-text-base` | `11px` | 400/600/700 | 1.4 | Body text in panel rows |
| `--ds-text-md` | `12px` | 600/800 | 1.4 | Tab label, primary CTA, section heading |
| `--ds-text-lg` | `13px` | 700 | 1.5 | Header brand wordmark |

Bold weights:
- 600: secondary emphasis (counts, role badges)
- 700: primary emphasis (button labels, section titles)
- 800: strongest emphasis (CTA buttons, top-level headings)

## Border radius

| Token | Value | Use |
|---|---|---|
| `--ds-radius-1` | `2px` | source-tag badge |
| `--ds-radius-2` | `3px` | severity strip, role badges |
| `--ds-radius-3` | `4px` | buttons, cards, inputs |
| `--ds-radius-4` | `8px` | modal dialog |
| `--ds-radius-pill` | `999px` | "Free & open source" pill, tab order index circle |

## Shadows

| Token | Value | Use |
|---|---|---|
| `--ds-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | subtle button lift |
| `--ds-shadow-md` | `0 4px 12px rgba(0,0,0,0.1)` | dropdown, popover |
| `--ds-shadow-lg` | `0 8px 30px rgba(0,0,0,0.2)` | modal dialog |

## Z-index scale

| Token | Value | Use |
|---|---|---|
| `--ds-z-base` | `0` | default |
| `--ds-z-sticky` | `5` | sticky toolbar within panel |
| `--ds-z-toast` | `100` | inline toast, "element not found" |
| `--ds-z-modal-backdrop` | `1000` | modal backdrop |
| `--ds-z-modal` | `1001` | modal dialog |
| `--ds-z-overlay-page` | `2147483646` | page-level overlays in Shadow DOM (must be near max int to escape any host z-index) |

## Focus indicator

All focusable elements MUST show a visible focus indicator on `:focus-visible`. Default rule:

```css
*:focus-visible {
  outline: 3px solid var(--ds-amber-500);
  outline-offset: 1px;
}
```

This applies to all buttons, links, inputs, selects, textareas, `[tabindex]` elements, etc. Individual components may override the offset only.

## Touch target size

Minimum `24×24` CSS pixels for ALL interactive elements (WCAG 2.2 AA — 2.5.8). The `--ds-space-12: 24px` token MUST be the minimum height/width (or `min-height` / `min-width`) on every button, checkbox, dropdown, link.

## Motion

| Token | Value | Use |
|---|---|---|
| `--ds-motion-fast` | `0.1s` | hover, focus indicator |
| `--ds-motion-base` | `0.15s` | tab switch, accordion expand |
| `--ds-motion-slow` | `0.3s` | row highlight fade |

Respect `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Disabled state

For any disabled control:
- `opacity: 0.4`
- `cursor: not-allowed`
- `aria-disabled="true"` AND/OR native `disabled` attribute
- Disabled controls are EXEMPT from the 4.5:1 contrast requirement (WCAG note)

## Naming convention

All custom properties MUST be prefixed `--ds-` (design system). No exceptions. This makes any non-token color literal in code easy to spot via grep `style="[^"]*#[0-9a-fA-F]`.
