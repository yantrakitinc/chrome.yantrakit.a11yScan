# UI Mistakes & Rules — Never Repeat These

## #1 Rule: 360px width constraint
This is a 360px wide panel. EVERY row must be validated for overflow. If items don't fit on one line, they go on separate lines. NEVER cram multiple items on one row and hope they fit. This is the most repeated mistake and the most critical rule.

## Mistakes made and lessons learned

### Layout
- **Header must be visually distinct from the rest of the dark panel.** Not the same #0f0d2e as the accordion. Use a slightly different shade or a visible border.
- **Tabs must look like tabs.** Not text links, not underlined words. User-approved style: icon above label, active tab has tinted background (amber-50) + colored bottom border (amber-500), inactive tabs are plain. Similar to the reference design the user provided.
- **Mode buttons can be cards but must be COMPACT.** Not 60px tall. Tight padding, short descriptions.
- **No wall of same color.** When multiple modes are active, they can't all be the same orange. Need visual differentiation.
- **"Current viewport only" is redundant.** Unchecked checkbox already communicates this.
- **Clear button doesn't need to be large.** Small text link or icon is enough.
- **Dark section total height must be minimal.** Every pixel of control height steals from content space.

### Font sizes
- **Minimum 11px for all text.** No exceptions.
- **Be consistent.** Pick 2-3 sizes and use them everywhere. Not 8 different sizes.
- **Stat labels (Violations/Passes/etc.) must be readable.** Not 8px.

### WCAG compliance (the tool must pass its own standards)
- **All interactive elements: 24px minimum target size.** Gear icon, collapse chevron, play sound buttons, overlay toggles — all must be at least 24x24px clickable area.
- **All text: 4.5:1 contrast ratio minimum.** No white/40 or white/50 on dark backgrounds. White text on amber-600 is only 3:1 — FAILS. Use darker amber or dark text on amber. Check text-zinc-500 on bg-zinc-50 — may fail.
- **All buttons need aria-labels** when they use icons/emoji instead of text.
- **Focus indicators on everything.** :focus-visible with visible outline.
- **🔊 emoji buttons fail.** No border, no background, no padding. Need proper button treatment with padding and aria-label.
- **⚠ warning icons need aria-labels.**

### Overflow (the #1 recurring mistake)
- **Every flex row needs overflow validation at 360px.** Not 400px, not 420px. 360px.
- **flex-wrap alone doesn't fix it** — wrapping creates ugly multi-line rows. Better to redesign the row to fit.
- **Labels like "EXPORT" and "HIGHLIGHT" are necessary.** Without them, users don't know what the button groups do. Keep them. If the row overflows, put each group on its own line — don't remove the labels.
- **Sub-tabs (Results/Manual/ARIA/Observe) can overflow at 360px.** Validate.
- **Bottom toolbar items MUST fit on their designated rows.** If they don't, split into more rows or reduce content.

### Accordion
- **Auto-collapse on scan/crawl START.** But user can manually expand anytime — never block expanding.
- **Collapsed summary is clickable to expand.** Always.
- **No "expand"/"collapse" text labels.** Just a chevron (▾/▴). But it must be a 24px+ target.
- **Accordion logic must be coherent.** One condition for collapsed summary, one for expanded content. Never show both or neither.

### Components
- **Screen Reader rows are too tall.** ~45px each = only 6 visible. Tighten to ~30px.
- **Role badges different widths cause misalignment.** Use fixed-width or min-width.
- **Mode button descriptions add height.** They repeat info already implied by the label. Consider tooltips instead.
- **Movie speed SHOULD show when movie mode is on.** It's a valid config for that mode.
- **Observer status "active — local only" is redundant.** The checked checkbox already says it's on.

### Architecture
- **Four top-level tabs are completely independent.** Scan | Screen Reader | Keyboard | AI Chat. No shared controls, no shared toolbar, no shared content.
- **Header is the ONLY shared element.** Logo + A11y Scan + Beta + CVD dropdown + pop-out button. NO gear icon.
- **Each tab owns its entire vertical space.** Action buttons, progress, results, toolbars — all tab-specific.
- **Scan tab has sub-tabs** (Results/Manual/ARIA/Observe) — these are secondary navigation, must look different from top tabs.
- **Gear icon belongs next to WCAG dropdowns** in the Scan tab accordion, NOT in the header.

### Redundant labels / text
- **No "Paused" label.** The ▶ Resume button already communicates the state.
- **No "Crawling" label in the progress bar.** The action button already says "Crawling…" and the collapsed summary shows "Crawl" tag.
- **No "Scanning" label in the progress bar.** The action button already says "Scanning…".
- **No "Observer active — local only" status strip.** The checked checkbox on the Observer mode already says it's on.
- **No "Current viewport only" text.** The unchecked Multi-Viewport checkbox already says it.
- **No "expand" / "collapse" text.** Just a chevron. No words.

### Copy for AI button
- **Copies JSON to clipboard.** No popup, no modal. Just copies and shows "Copied!" confirmation. That's it.

### Settings / Gear icon
- **Gear icon goes next to WCAG dropdowns** in the Scan tab accordion. User explicitly said this.
- **Header does NOT have a gear icon.** Only: Logo + A11y Scan + Beta + CVD dropdown.
- **NOTE:** This means settings are only accessible when Scan tab is active AND accordion is expanded. Screen Reader and Keyboard tabs have no settings access. This may need revisiting.

### Progress bar behavior
- **Action button text changes:** "Scanning…" during single page scan, "Crawling…" during crawl. This IS the status indicator.
- **Progress bar has no text label.** Just the bar + page count/URL (for crawl) + pause/cancel buttons.
- **Pause/cancel buttons must be 24px+ target size.**

### Accordion — user rules (do NOT override)
- **Accordion can be collapsed ANYTIME.** First load, during scan, during crawl, with results, without results. ALWAYS.
- **Accordion can be expanded ANYTIME.** Even during scanning. NEVER block expanding.
- **Auto-collapse on scan/crawl start.** This is an AUTO behavior. User can manually override by expanding.
- **Auto-expand on Clear.**
- **Disabled when busy (scanning/crawling):** Mode toggles, WCAG dropdowns, Multi-Viewport checkbox, gear/settings button, reset button, top-level tabs (Screen Reader + Keyboard), action button.
- **NOT disabled when busy:** Accordion expand/collapse (always works), movie speed dropdown (can adjust), AI Chat tab (always accessible), pause/cancel buttons (obviously).
- **NOT disabled when paused:** Everything re-enables when paused. User can change modes, WCAG, settings.

### Things I kept ignoring
- **360px width.** I designed for 400px, then 420px, then 356px. The minimum is 360px. Every element must be validated at this width. I ignored this REPEATEDLY.
- **Wrapping.** My #1 recurring mistake. I put too many items on one row, they wrap, the user has to tell me again. EVERY row must fit at 360px or be split into separate rows BY DESIGN.
- **Making executive decisions without asking.** I moved the gear icon to the header without being told. I blocked accordion expanding during scanning without being told. I removed the "Overlays" label without being told. I kept making decisions that contradicted the user's instructions.

### Things NOT in the mockup yet
- **Accessibility Inspector (hover)** — click to inspect, hover over elements on the page, tooltip shows role/name/aria/tabindex/violations. Documented in product definition but not in mockup.
- **DevTools sidebar pane** — shows accessibility info for selected element in Elements panel. Documented but not in mockup.
- **Settings drawer content** — observer domain filters, throttle, max history, config upload/paste. Exists in code but the gear icon placement is inconsistent.
- **Page rule wait "Scan page, then continue" button** — user explicitly said this label, not "Rescan first".

### Decision-making
- **NEVER make code changes without being told to.** Discussion is not permission to code.
- **NEVER assume behavior.** If unsure, ask. Don't decide that accordion can't expand during scanning.
- **NEVER abbreviate labels.** "MV" means nothing. "Obs" means nothing. Use full words.
- **ALWAYS validate visually before claiming something is fixed.** I can't see the output — I must reason about pixel widths and heights.
- **Answer questions FIRST.** When the user asks a question, answer it. Don't jump to code changes.
- **Read the product definition BEFORE guessing.** When asked what a feature does, check the docs — don't make up behavior.
- **NEVER update code directly.** Always update charts and docs FIRST, then update code to match. Charts and docs are the source of truth, not the code.
- **Every list must be complete.** No excerpts, no "and X more." If showing 45 passed rules, show all 45 with full details (rule ID, description, WCAG criterion, level, element count).
- **Movie Mode stays in Scan tab form** as a mode toggle. Only the Movie toggle in the bottom toolbar was moved to the Keyboard tab.
