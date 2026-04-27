# A11y Scan — Product Definition

## What is this?

A11y Scan is a Chrome extension that audits web pages for accessibility violations. It runs axe-core against pages, maps results to WCAG criteria, and provides visual overlays, manual review checklists, ARIA pattern validation, and multi-format exports.

## Who uses it?

1. **Developers** — fixing violations in their own code
2. **QA engineers** — verifying accessibility before release
3. **Designers** — checking their designs render accessibly
4. **Accessibility auditors** — generating reports for clients
5. **Product managers** — understanding the a11y state of their product

## Core capabilities

### 1. Scan a single page
Run axe-core on the current page. Get violations grouped by WCAG criterion, sorted by severity. Each violation shows affected elements, failure reason, and a link to WCAG guidance. Results include passes and incomplete (needs-review) items.

### 2. Scan at multiple viewports
Resize the browser to mobile (375px), tablet (768px), and desktop (1280px) widths — or custom widths from config — and scan at each. Results are diffed into "all viewports" vs "viewport-specific" violations, revealing responsive-only issues.

**Breakpoint buckets (used with Observer Mode):** Breakpoints also define bucket ranges. With 3 breakpoints, scans are categorized into 4 buckets:
- `0 to [breakpoint 1]`
- `[breakpoint 1]+1 to [breakpoint 2]`
- `[breakpoint 2]+1 to [breakpoint 3]`
- `[breakpoint 3]+1 and beyond`

The user can click any breakpoint chip in the extension panel to resize the window to that exact width. Manual resizes are also supported — scans captured during observer mode are tagged with whichever bucket the current window width falls into.

### 3. Crawl an entire site
Depth-first traversal scanning every reachable page. Two crawl modes:
- **Follow** — follows all `<a href>` links from the starting page. Respects `rel="nofollow"` (skips those links). Stays within the same origin. Configurable scope (URL prefix) and max pages.
- **URL List** — a curated list of specific URLs to scan. The user builds this list by:
  - Adding a sitemap.xml URL (online) — fetches and displays all links in a modal
  - Uploading a sitemap XML file — parses and displays all links in a modal
  - Manually adding individual URLs
  - Each URL in the list has an "Omit" toggle — doesn't remove it, just skips it during the crawl
  - Extra URLs can be added that aren't in the sitemap
  - The crawl only visits non-omitted URLs in the list, following them in order

During crawl: live progress bar, pause/resume/cancel, per-page results updating in real time. Handles redirects, auth-gated pages, and configurable page rules (pause points for login, interaction, or deferred content). Configurable delay between pages.

### 4. Observer Mode (passive scanning)
When enabled, automatically scans every page the user navigates to. Results accumulate in a local history. Manual scans are also logged. Each entry shows its full timestamp, page title, URL, and violation count. Filterable by domain and minimum violations, exportable as JSON. All data stored locally — nothing leaves the browser.

Observer auto-scans are suppressed while a crawl is actively running (crawl owns navigation). When crawl is paused or complete, observer resumes.

**No consent modal.** Inline help text on the empty state explains what Observer Mode does and that data stays local.

### 5. Visual overlays
Three toggleable overlays rendered in a Shadow DOM on the page. All overlay colors must have high contrast against ANY background (light or dark pages) — use strong outlines, solid fills with borders, or double-stroke techniques to ensure visibility everywhere.
- **Violation badges** — numbered, clickable (scrolls to result in panel). One strong color that stands out over any background.
- **Tab order** — numbered badges on every focusable element + connecting lines showing keyboard navigation sequence
- **Focus gaps** — dashed outlines on interactive elements missing keyboard access

### 6. Movie Mode
Animated walkthrough of the keyboard tab order. Steps through each focusable element one at a time — scrolls to it, highlights it. Configurable speed. Play/pause/stop controls. Can be toggled on/off anytime after results exist. Works during crawl when paused on a page or after crawl completes and you navigate to a specific crawled page.

### 7. Manual review checklist
WCAG criteria that can't be automated — things only a human can judge. Filtered by what's on the page (video criteria only show if the page has video). Each criterion gets a Pass/Fail/N/A toggle. State persists per tab. Included in exports. **UI NOTE:** This needs an immaculate, easily understood design. The current UI is poor — the checklist must be crystal clear about what each criterion means, what action the user should take, and what their current progress is.

### 8. ARIA pattern validation
Detects ARIA widgets on the page and validates each against the WAI spec. Shows which attributes are missing or incorrect.

**Currently supported (12):**
tablist, menu, menubar, dialog, alertdialog, combobox, slider, tree, radiogroup, checkbox, switch, accordion (heuristic detection)

**Not yet supported (future):**
listbox, grid, treegrid, toolbar, tooltip, feed, breadcrumb, progressbar, spinbutton, live regions (alert, status, log)

### 9. Color blindness simulation
Applies SVG color matrix filters to simulate 8 types of color vision deficiency in real time on the current page.

### 10. Report export
Three formats:
- **JSON** — enriched with WCAG mappings, fix suggestions, DOM context, CSS computed styles, framework hints (React/Vue/Angular component names), file path guesses. Designed for AI agents and CI pipelines.
- **HTML** — self-contained report with inline styles. Shareable.
- **PDF** — multi-page with headers/footers. Generated client-side.

### 11. Test configuration
JSON config files that override all defaults: WCAG version/level, viewport widths, timing, auth credentials, rule inclusion/exclusion, enrichment flags, page rules, mock API endpoints. Can be built via the website's Test Config Builder wizard or pasted/uploaded in the extension.

**TODO (later):** The website's Test Config Builder UI needs a redesign — it's currently poor UX.

### 12. Mock API interception
Overrides `fetch` and `XMLHttpRequest` to return canned responses for matching URL patterns. Ensures deterministic scan results against API-driven pages.

### 13. Element highlighting
Click any violation node → element is scrolled into view and highlighted with a 3-second amber glow.

### 14. Pop-out window
Panel expands to screen width up to a max width. Full pop-out to separate window deferred to later.

### 15. Screen Reader tab
A top-level tab showing every element on the page in the order a screen reader encounters them (DOM order, respecting aria-hidden, display:none, aria-owns). Each row shows the computed accessible name + role + states (expanded, checked, required, etc.). Click any row to highlight the element on the page. 🔊 button next to each row uses the browser's SpeechSynthesis API to speak that element and its children — exactly what a screen reader would say. "Play All" button reads through the entire page sequentially, highlighting each element as it goes. Rescan button refreshes the tree when the page changes.

### 16. Keyboard tab
A top-level tab for keyboard navigation audit:
1. **Tab order list** — every focusable element in sequence with index, selector, role, accessible name, and whether it has a visible focus indicator
2. **Focus gaps** — interactive elements that can't be reached by keyboard, with the reason (no tabindex, div with onclick, etc.)
3. **Focus indicators** — per-element check for visible :focus styles
4. **Keyboard traps** — elements where focus gets stuck
5. **Skip links** — whether the page has skip navigation and where it points
6. **Movie Mode** — lives here as its natural home. Play button walks through the tab order visually.
Rescan button refreshes when the page changes.

### 17. Accessibility Inspector (hover)
Click "Inspect" in the extension, hover over any element on the page. A floating tooltip shows: role, accessible name, aria-* attributes, tabindex, focus state, and any violations on that element. Built using the Shadow DOM overlay system. Additionally, a DevTools sidebar pane (`chrome.devtools.panels.elements.createSidebarPane()`) shows accessibility info for the selected element in the Elements panel.

### 18. Per-tab rescan
Each top-level tab (Scan, Screen Reader, Keyboard, AI Chat) has its own Rescan button where applicable. Pages change — user opens modals, expands accordions, navigates SPAs, logs in. Rescan refreshes that tab's data with one click without reconfiguring settings.

### 19. AI Chat tab (powered by Chrome's built-in Gemini Nano)
A fourth top-level tab: Scan | Screen Reader | Keyboard | **AI Chat**. Uses Chrome's built-in AI (Gemini Nano) — runs locally, no API key, no cost, no data leaves the browser.

**How it works:**
- Any violation in the Scan tab has an "Explain Further" button
- Clicking it opens the AI Chat tab with that violation pre-loaded as context
- The AI explains the violation in plain English, suggests fixes, and answers follow-up questions
- The user can have a back-and-forth conversation about the issue

**Freeform chat:**
- "New chat" button for questions not tied to a specific violation
- Ask anything about accessibility, WCAG criteria, implementation patterns

**AI capabilities:**
1. Explain violations in plain language
2. Suggest alt text for images based on page context
3. Suggest better link text for generic "click here" links
4. Generate prioritized action plan after a scan
5. Help with manual review criteria — explain what to look for on the specific page
6. Describe the screen reader experience

**Chat history:**
- Last 20 conversations stored in `chrome.storage.local`. Hard limit — oldest deleted when cap hit.
- Each chat: timestamp, auto-generated title (from first message or violation name), full message history
- Accessed via a drawer that slides in from the right, opened by a menu icon in the AI Chat tab header
- Drawer shows the 20 chats as a list — click to load, each has a delete button

**Chat management:**
- Each chat has a delete button (single delete)
- Checkbox selection for bulk delete
- "Select all" / "Delete selected" for batch operations
- Confirmation before deletion

### 20. Right-click context menu
Right-clicking the extension icon shows custom menu items via `chrome.contextMenus` API:
- **Open Panel** — opens the side panel
- **Settings** — opens the settings/config view
- **Chat History** — opens the AI Chat tab with history view
- **Clear All Data** — clears all stored data (with confirmation)

### 21. Custom heuristic rules (beyond axe-core)
axe-core has gaps. The extension adds its own DOM/CSS heuristic checks to catch what axe misses:

1. **Decorative symbols without `aria-hidden`** — `<span>`, `<i>`, `<div>` containing only punctuation/symbols (`>`, `•`, `|`, `→`, `—`, etc.) with no `aria-hidden="true"`.
2. **Icon fonts without text alternatives** — elements with icon-font classes (`fa-*`, `material-icons`, `glyphicon-*`, etc.) that have no `aria-label`, `aria-hidden`, or visible text.
3. **CSS `::before`/`::after` with meaningful content** — pseudo-elements with `content` that isn't empty or a decorative character. Detected via `getComputedStyle`.
4. **Generic link text** — links with vague text: "click here", "read more", "learn more", "here", "more", "link". Flags WCAG 2.4.4.
5. **Visual order vs DOM order mismatch** — CSS flexbox/grid `order` or absolute positioning that makes visual reading order differ from DOM order. Compares `getBoundingClientRect` positions to DOM sequence.
6. **Small touch targets** — elements with rendered dimensions below 24×24px minimum (WCAG 2.5.8). Measures actual computed size.
7. **Scroll containers without keyboard access** — elements with `overflow: auto/scroll` but no `tabindex`. Keyboard users can't scroll these.
8. **Missing `autocomplete` on common inputs** — name, email, phone, address fields without `autocomplete` attribute (WCAG 1.3.5).
9. **Focus indicator check** — verifies `:focus` styles exist and produce a sufficient visual change. Compares computed styles on focus vs blur.
10. **Inline `!important` on text styling** — `font-size`, `line-height`, `letter-spacing`, `word-spacing` with `!important` blocks user stylesheet overrides (WCAG 1.4.12).
11. **Non-text contrast** — checks borders, backgrounds of UI components (form controls, icons, custom checkboxes) against their surrounding background color (WCAG 1.4.11).
12. **Placeholder as only label** — form inputs using `placeholder` as their sole label with no `<label>`, `aria-label`, or `aria-labelledby` (WCAG 1.3.1, 3.3.2).
13. **Visual headings without semantic markup** — text styled large/bold (>=1.5x body font or bold) that isn't an `<h1>`–`<h6>` or `role="heading"`. Detected via `getComputedStyle` comparison (WCAG 1.3.1, 2.4.6).
14. **Heading tags used for styling** — `<h1>`–`<h6>` elements with font-size <= surrounding text, or inline within paragraphs, or sentence-length content. Misuse of headings for visual styling (WCAG 1.3.1).
15. **Links indistinguishable from text** — links within text blocks with no underline AND < 3:1 contrast ratio against surrounding text AND no other visual distinction (bold, italic, different font). Pure CSS computation (WCAG 1.4.1).
16. **Div/span as button** — elements with click handlers (`onclick`, `addEventListener('click')`) but no `role="button"`, no `tabindex`, no keyboard handler. Detected via event listener inspection and attribute checks (WCAG 4.1.2, 2.1.1).
17. **Focus removal (`outline: none`)** — elements with `:focus { outline: none }` or `outline: 0` without a replacement focus indicator. Detected via computed style comparison (WCAG 2.4.7).
18. **`aria-hidden` with focusable children** — deeper than axe's check. Walks the subtree of `aria-hidden="true"` elements to find any focusable descendants (links, buttons, inputs, tabindex elements) (WCAG 4.1.2).
19. **Broken ARIA references** — `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns` pointing to IDs that don't exist in the DOM (WCAG 4.1.2).
20. **Focus obscured by sticky headers** — checks if the focused element is behind a `position: fixed/sticky` element. Compares focus target's bounding rect against sticky elements' rects (WCAG 2.4.11 Focus Not Obscured).
21. **Consistent navigation order across pages** — during crawl, compares `<nav>` content order across pages. If shared nav items appear in different order, flags (WCAG 3.2.3).
22. **Consistent link identification** — during crawl, maps `href` to accessible names across pages. Same URL with different text = flag (WCAG 3.2.4).
23. **Show password toggle detection** — `<input type="password">` without a nearby toggle to reveal the password (WCAG 3.3.8 Accessible Authentication).
24. **Breadcrumb validation** — breadcrumb nav without `aria-label`, missing `aria-current="page"` on current item, breadcrumb list not inside `<nav>` (WCAG 1.3.1, 2.4.8).
25. **No visible label (icon-only buttons)** — interactive elements with `aria-label` but no visible text. Voice control users can't activate by speaking the name (WCAG 2.5.3).
26. **Carousel accessibility** — detects carousels (common class patterns, role="region" with panels) and checks for prev/next buttons with accessible names, pagination labels, proper ARIA (WCAG 4.1.2, 2.5.1).
27. **Auto-playing/infinite animation without pause** — CSS `animation` with `infinite` iteration and no nearby pause/stop control. Also `<marquee>` elements (WCAG 2.2.2).
28. **New tab links without warning** — `<a target="_blank">` with no visual indicator or `aria-label` mentioning "opens in new tab/window" (WCAG 3.2.5).
29. **Reflow at 320px** — during viewport scan, checks for horizontal scroll at 320px width (`scrollWidth > clientWidth`) (WCAG 1.4.10).
30. **SPA route changes without focus management** — detects URL hash/pushState changes and checks if focus is programmatically moved to new content. Hooks into `popstate`/`hashchange` (WCAG 4.1.3).
31. **`prefers-reduced-motion` not respected** — pages with CSS animations that don't have a `@media (prefers-reduced-motion: reduce)` query to disable/reduce them (WCAG 2.3.3).
32. **Target size with overlap calculation** — enhanced version of #6: draws a virtual 24px circle centered on undersized targets and checks for overlap with neighboring interactive elements (WCAG 2.5.8).
33. **Suspicious alt text** — alt text matching the filename (`IMG_0234.jpg`), containing "image of", "photo of", "picture of", or just the file extension. Pattern matching for known bad alt text (WCAG 1.1.1).

Full research: `/docs/BEYOND-AXE-CORE-GAPS.md` (75+ checks across 11 categories with priority matrix).

## Panel UI architecture

The side panel has three completely independent top-level tabs — three distinct features sharing only the header. Minimum panel width: 360px, expands to screen width up to a max.

### Header (shared, static)
- Logo + "A11y Scan" + Beta badge
- CVD simulation dropdown
- No gear icon here — gear is inside the Scan tab accordion, next to WCAG dropdowns

### Top-level tabs: Scan | Screen Reader | Keyboard | AI Chat
Always visible. Disabled when a scan/crawl is actively running (except AI Chat — always accessible). Each tab owns its ENTIRE vertical space below — no shared controls, no shared toolbars, no shared content.

### Scan tab (owns everything below)
- **Accordion** (collapsible anytime, auto-collapses on scan/crawl start, auto-expands on clear):
  - Mode toggles: Crawl / Observe / Movie (with checkboxes + descriptions, disabled when busy)
  - Multi-Viewport checkbox + viewport values + edit
  - Crawl mode dropdown (when Crawl on + idle)
  - Observer status (when Observer on)
  - Movie speed (when Movie on)
- **Action button**: Scan Page / Start Crawl / Scan This Page / Scanning… / Crawling… + Clear
- **Progress**: bar + pause/cancel (when active, below action button)
- **Page rule wait**: warning + Continue / Scan then continue / Cancel
- **Sub-tabs**: Results / Manual / ARIA / Observe
- **Content**: violations (expandable, sorted critical→minor), manual review checklist (Pass/Fail/N/A), ARIA widget validation, observer scan history with timestamps
- **Toolbar**: Export (JSON/HTML/PDF/📋 Copy) + Highlight (☐ Violations / ☐ Tab / ☐ Gaps)

### Screen Reader tab (owns everything below)
- **Analyze button** + Rescan
- **Element list** in screen reader reading order (DOM order, respecting aria-hidden/display:none/aria-owns)
- Each row: computed accessible name + role + states (expanded, checked, required) + 🔊 speak button
- Click any row → highlight element on page
- **Play All** button: reads through entire page sequentially, highlighting each element
- Uses browser SpeechSynthesis API — no dependencies

### Keyboard tab (owns everything below)
- **Analyze button** + Rescan
- **Tab order list**: every focusable element in sequence — index, selector, role, accessible name, has visible focus style
- **Focus gaps**: interactive elements missing keyboard access, with reason
- **Focus indicators**: per-element check for visible :focus styles
- **Keyboard traps**: elements where focus gets stuck
- **Skip links**: whether page has skip navigation, where it points
- **Movie Mode**: Play button walks through tab order visually. Its natural home.

### AI Chat tab (owns everything below)
- **Chat view**: message thread (user + AI), input box at bottom
- **History drawer**: slides in from the right, opened by a menu icon. Shows last 20 saved chats with timestamps and titles. Click to load, each has delete button.
- **New chat** button for freeform questions
- **Pre-loaded context**: when opened via "Explain Further" on a violation, the chat starts with that violation's details as context
- **Chat management**: delete single, bulk select + delete, select all
- Uses Chrome's built-in Gemini Nano — local, free, private

## Phase × Mode behavior

See `docs/PHASE_MODE_CHART.md` for the complete source-of-truth chart covering:
- Action button text for every mode × phase combination
- What's disabled in each phase
- UI section visibility per phase
- Results content by mode (congruency rules)
- Sub-tab visibility
- Collapsed accordion summary format

The chart is the source of truth. The UI must match the chart.

## Modes and combinations

**Three independent mode toggles + one modifier.** All can be toggled on/off at any time.

**Modes:**
- **Crawl** — stateful (idle → running → paused → complete). Traverses site page by page.
- **Observer** — binary on/off. Auto-scans every page you navigate to.
- **Movie Mode** — binary on/off. Plays an animated tab-order walkthrough after each scan.

**Modifier:**
- **Multi-Viewport (MV)** — applies to whatever scan is happening. Scans at multiple widths (or categorizes observer scans into breakpoint buckets).

### 8 mode combinations (modes only, MV doubles each)

| # | Active modes | Primary action | Behavior |
|---|---|---|---|
| 1 | None | Scan Page | Single-page scan |
| 2 | Crawl | Start Crawl | Traverse site, scan each page |
| 3 | Observer | Scan This Page | Auto-scan every page you navigate to |
| 4 | Movie | Scan Page + Play | Scan page, then play tab-order walkthrough |
| 5 | Crawl + Observer | Start Crawl | Crawl runs; when paused, observer takes over for manual browsing; resume = crawl continues |
| 6 | Crawl + Movie | Start Crawl | Each page: scan → play movie → advance to next page |
| 7 | Observer + Movie | Scan This Page | Each navigated page: auto-scan → play movie |
| 8 | Crawl + Observer + Movie | Start Crawl | Full combo — crawl drives, movie plays per page, observer logs |

### Interaction rules

- **Modes are independent toggles.** The user can turn any mode on or off at any time, including mid-flow.
- **Example flow:** Start a crawl → pause mid-crawl → toggle Observer on → browse around → toggle Observer off → Resume crawl. Or reverse.
- **Crawl running suppresses Observer auto-scans** (crawl owns navigation). Observer toggle stays on, just dormant. Auto-scans resume when crawl is paused, complete, or cancelled.
- **Multi-Viewport applies to whatever scan is happening.** Toggle it mid-crawl and it applies to remaining pages. Toggle it during observer and subsequent auto-scans use breakpoint buckets.
- **Movie Mode plays after each scan** regardless of mode. With Crawl, it plays on each page before advancing. With Observer, it plays on each auto-scanned page.

## What the UI must support

1. **Mode selection** — independent toggles for Crawl and Observer, plus a Multi-Viewport modifier. Any combination. Clear descriptions so new users understand each mode.
2. **Config upload** — visible, not buried. Show current config status. Upload JSON, paste JSON, or link to website builder.
3. **WCAG selection** — version (2.0/2.1/2.2) and level (A/AA/AAA). Rarely changed once set.
4. **Viewport customization** — show current widths, provide a way to edit them (inline or via config).
5. **Contextual action button** — text adapts to mode: "Scan Page" / "Start Crawl" / "Scan This Page". One button, changes meaning.
6. **Crawl configuration** — discovery mode dropdown, sitemap URL input, URL list display. Only visible when Crawl mode is active.
7. **Observer status** — green indicator when active. Must be visible at a glance.
8. **Results display** — violations grouped by WCAG criterion, expandable nodes, highlight buttons. Tabs: Results, Manual Review, ARIA, Observer History.
9. **Tabs visibility** — hidden until there are results or observer history.
10. **Clear button** — always visible when results exist. Unmissable.
11. **Crawl progress** — live progress bar with page count, current URL, pause/resume/cancel.
12. **Page rule wait UI** — shown when crawl pauses for user interaction. Continue/Rescan/Cancel.
13. **Post-scan tools** — export (JSON/HTML/PDF), overlays (violations/tab order/focus gaps), movie mode. Always accessible after a scan.
14. **Pop-out** — button to extract results to a separate window. Return button to bring them back.
15. **CVD simulation** — dropdown in header, always accessible.
16. **Config panel** — gear icon opens an overlay for pasting/uploading test configs and observer settings.
17. **Accessibility** — the tool itself must pass WCAG 2.2 AA. High contrast, clear focus states, proper ARIA attributes, keyboard navigable.
18. **Space efficiency** — side panel is ~400px wide. Every pixel matters. Controls should collapse or minimize after scan to maximize results space.
19. **Future-proofing** — the architecture must allow adding new scan types, new overlays, new export formats, and new config options without redesigning the layout.
20. **Empty state (first view)** — minimal: the mode toggles, the action button, the gear icon for config upload, the CVD dropdown. No bullet list of features. Inline help text explains what each mode does (including that Observer data stays local) so a new user understands the tool at a glance without needing a consent modal or tutorial.
