# F18 — Panel Layout & Navigation

## Purpose

Defines the overall structure of the Chrome side panel: header, tabs, accordion, content areas, toolbar, and footer. This is the container that all features live in.

## Dependencies

- None (foundational)

## Behavior

### Panel dimensions

- **Minimum width**: 360px (Chrome side panel constraint).
- **Maximum width**: screen width.
- **Height**: fills the available vertical space.

### Architecture

Four completely independent top-level tabs sharing only the header:

```
┌─────────────────────────────┐
│ Header (shared)             │
├─────────────────────────────┤
│ Scan | SR | Keyboard | Chat │  ← Top tabs
├─────────────────────────────┤
│                             │
│ Tab-specific content        │  ← Each tab owns this entire space
│                             │
├─────────────────────────────┤
│ Footer (shared)             │
└─────────────────────────────┘
```

### Header

Always visible. Contains:
- **Logo** (20×20px) + "**A11y Scan**" text + **Beta** badge
- **CVD dropdown** (F08 — color vision simulation)

**No gear icon in header.** Gear is inside the Scan tab accordion, next to WCAG dropdowns.

### Top tabs

Always visible. Four tabs with icon above label:
- **Scan** (magnifying glass icon)
- **Screen Reader** (speaker icon)
- **Keyboard** (keyboard icon)
- **AI Chat** (chat bubble icon)

Active tab: amber-50 background + amber-500 bottom border + amber-900 text.
Inactive tabs: zinc-500 text, hover → zinc-700 + zinc-50 background.

Tab icons: SVG, not emoji. Clean, professional.

**Disabled when busy**: Screen Reader and Keyboard tabs are disabled during scanning/crawling (grayed out, not clickable). AI Chat is NEVER disabled.

### Scan tab layout

Top to bottom:

1. **Debossed accordion** — collapsible form area:
   - Toggle bar (always visible): WCAG label + dropdowns + gear + reset + chevron
   - Animated body (collapsible): mode toggles, MV, crawl config, movie speed
   - Action button area: "**Scan Page**" button + clear button

2. **Progress bar** (conditional): scan or crawl progress

3. **Page rule wait** (conditional): crawl pause notification

4. **Sub-tabs** (conditional): Results / Manual / ARIA / Observe

5. **Content area** (scrollable): results, manual review, ARIA, observer history. This div has `flex:1; overflow-y:auto; min-height:0` so it takes remaining vertical space and scrolls internally.

6. **Bottom toolbar** (conditional, pinned): Export (JSON/HTML/PDF/Copy) + Highlight (Violations only — Tab order and Focus gaps overlays moved to Keyboard tab). The toolbar has `flex-shrink:0` and is a sibling of the content area (NOT inside it), so it stays pinned at the bottom while content scrolls above it.

### Flex layout chain (critical for toolbar pinning)

The entire height chain must use flex with proper constraints so the toolbar stays visible:

```
body (height:100vh; display:flex; flex-direction:column; overflow:hidden)
  └─ #header (flex-shrink:0)
  └─ #top-tabs (flex-shrink:0)
  └─ #tab-panels (flex:1; min-height:0; overflow:hidden; display:flex; flex-direction:column)
       └─ .tab-panel (flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden)
            └─ .accordion-wrapper (flex-shrink:0)
            └─ .sub-tabs (flex-shrink:0)
            └─ #scan-content (flex:1; overflow-y:auto; min-height:0)
            └─ .toolbar (flex-shrink:0)  ← PINNED, never scrolls
  └─ #footer (flex-shrink:0)
```

**Every flex container in this chain MUST have `min-height:0`** to allow shrinking. Without it, flex items default to `min-height:auto` which prevents shrinking below content size, causing the toolbar to be pushed off-screen.

### Accordion behavior

Per PHASE_MODE_CHART.md Chart 9:
- **Debossed/inset style**: inset shadow on all sides, darker background than content.
- **Smooth animation**: CSS `grid-template-rows: 1fr ↔ 0fr` with `transition: 0.2s ease`.
- **Can be collapsed ANYTIME**: first load, during scan, with results, without results.
- **Can be expanded ANYTIME**: even during scanning. Never blocked.
- **Auto-collapse**: on scan/crawl start. User can manually override.
- **Auto-expand**: on Clear.

### Button styles

Unified button styles across the panel:

**Primary buttons** (e.g., "Scan Page", "Analyze", "Apply"):
- `font-weight: 800`
- `background: #f59e0b` (amber)
- `border-radius: 4px`

**Destructive buttons** (e.g., "Clear", "Cancel", "Delete"):
- `font-weight: 700`
- `border: 1px solid #fecaca` (red-200)
- `border-radius: 4px`

### Collapsed accordion summary

Format: `WCAG [version] [level] · [mode tags]`

Examples:
- `WCAG 2.2 AA` (no modes → "Single page" text)
- `WCAG 2.2 AA · Crawl`
- `WCAG 2.2 AA · Crawl · Observer`

When >2 modes active: `WCAG 2.2 AA · 4 modes` (prevents overflow at 360px).

Mode tags are color-coded:
- Crawl: sky/blue
- Observer: emerald/green
- Movie: violet/purple
- Multi-Viewport: amber

### Footer

Always visible at bottom. One line: "A11y Scan **beta** · Feedback (link)". Text-[11px].

### 360px width rules

Per UI_MISTAKES_AND_RULES.md:
- **Every row must fit at 360px.** Not 400px, not 420px.
- If items don't fit on one line, they go on separate lines — don't cram.
- Validate every flex row for overflow.

### WCAG compliance of the panel itself

The extension must pass its own standards:
- All text: minimum 11px
- All interactive elements: minimum 24×24px target size
- All text: 4.5:1 contrast ratio minimum
- All buttons need aria-labels when using icons
- Focus indicators on everything: `:focus-visible` with 3px amber outline
- Proper ARIA roles: `role="tab"`, `aria-selected`, `role="tablist"`, `role="dialog"`, `aria-modal`, etc.

## Acceptance Criteria

1. Panel renders at 360px width without horizontal overflow.
2. Header shows logo, brand, beta badge, CVD dropdown. No pop-out button.
3. No gear icon in header.
4. Four top-level tabs with icon above label.
5. Active tab has amber styling (bg, border, text color).
6. Screen Reader and Keyboard tabs disabled during busy.
7. AI Chat tab never disabled.
8. Accordion uses smooth CSS grid animation.
9. Accordion can be expanded/collapsed in any phase.
10. Auto-collapse on scan start, auto-expand on Clear.
11. Collapsed summary shows WCAG version/level + mode tags.
12. Mode tags are color-coded per mode.
13. Overflow handled at >2 modes ("N modes" fallback).
14. Footer always visible.
15. All text minimum 11px.
16. All targets minimum 24×24px.
17. All contrast minimum 4.5:1.
18. Focus-visible on all interactive elements.
