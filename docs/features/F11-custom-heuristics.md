# F11 — Custom Heuristic Rules

## Purpose

33 custom DOM/CSS heuristic checks that catch accessibility issues axe-core misses. These extend the scan engine beyond what any off-the-shelf tool provides.

## Dependencies

- F01 (Single Page Scan) — runs alongside axe-core scan

## Behavior

### When they run

Custom heuristic checks run after axe-core completes, as a separate pass. Results are merged into the main violation/pass lists and mapped to WCAG criteria.

### The 33 rules

Each rule has: ID, description, what it detects, WCAG criterion, detection method.

| # | Rule | WCAG | Detection |
|---|---|---|---|
| 1 | Decorative symbols without `aria-hidden` | 4.1.2 | `<span>`, `<i>`, `<div>` containing only punctuation/symbols (>, •, \|, →, —) with no `aria-hidden="true"` |
| 2 | Icon fonts without text alternatives | 1.1.1 | Elements with icon-font classes (`fa-*`, `material-icons`, `glyphicon-*`) with no `aria-label`, `aria-hidden`, or visible text |
| 3 | CSS `::before`/`::after` with meaningful content | 1.1.1 | Pseudo-elements with `content` that isn't empty or decorative. Via `getComputedStyle` |
| 4 | Generic link text | 2.4.4 | Links with vague text: "click here", "read more", "learn more", "here", "more", "link" |
| 5 | Visual order vs DOM order mismatch | 1.3.2 | CSS flexbox/grid `order` or absolute positioning causing visual-to-DOM order divergence. `getBoundingClientRect` comparison |
| 6 | Small touch targets | 2.5.8 | Elements with rendered dimensions below 24×24px. `getComputedStyle` for actual size |
| 7 | Scroll containers without keyboard access | 2.1.1 | Elements with `overflow: auto/scroll` but no `tabindex` |
| 8 | Missing `autocomplete` on common inputs | 1.3.5 | Name, email, phone, address fields without `autocomplete` attribute |
| 9 | Focus indicator check | 2.4.7 | `:focus` styles that don't produce visible change. Computed style comparison |
| 10 | Inline `!important` on text styling | 1.4.12 | `font-size`, `line-height`, `letter-spacing`, `word-spacing` with `!important` blocking user overrides |
| 11 | Non-text contrast | 1.4.11 | Borders/backgrounds of UI components against surrounding background |
| 12 | Placeholder as only label | 1.3.1, 3.3.2 | `<input>` with `placeholder` as sole label — no `<label>`, `aria-label`, or `aria-labelledby` |
| 13 | Visual headings without semantic markup | 1.3.1, 2.4.6 | Text styled large/bold (≥1.5× body font or bold) that isn't `<h1>`–`<h6>` or `role="heading"` |
| 14 | Heading tags used for styling | 1.3.1 | `<h1>`–`<h6>` with font-size ≤ surrounding text, or inline within paragraphs |
| 15 | Links indistinguishable from text | 1.4.1 | Links within text with no underline AND <3:1 contrast against surrounding text AND no bold/italic |
| 16 | Div/span as button | 4.1.2, 2.1.1 | Elements with click handlers but no `role="button"`, no `tabindex`, no keyboard handler |
| 17 | Focus removal (`outline: none`) | 2.4.7 | `:focus { outline: none/0 }` without replacement focus indicator |
| 18 | `aria-hidden` with focusable children | 4.1.2 | Deep subtree walk of `aria-hidden="true"` elements for focusable descendants |
| 19 | Broken ARIA references | 4.1.2 | `aria-labelledby`, `aria-describedby`, `aria-controls`, `aria-owns` pointing to non-existent IDs |
| 20 | Focus obscured by sticky headers | 2.4.11 | Focused element behind `position: fixed/sticky` element. Bounding rect comparison |
| 21 | Inconsistent navigation order | 3.2.3 | During crawl: `<nav>` content order differs across pages |
| 22 | Inconsistent link identification | 3.2.4 | During crawl: same `href` with different accessible names across pages |
| 23 | Show password toggle detection | 3.3.8 | `<input type="password">` without nearby toggle to reveal password |
| 24 | Breadcrumb validation | 1.3.1, 2.4.8 | Breadcrumb nav without `aria-label`, missing `aria-current="page"`, not inside `<nav>` |
| 25 | No visible label (icon-only buttons) | 2.5.3 | Interactive elements with `aria-label` but no visible text |
| 26 | Carousel accessibility | 4.1.2, 2.5.1 | Carousels without prev/next buttons, pagination labels, or proper ARIA |
| 27 | Auto-playing/infinite animation | 2.2.2 | CSS `animation` with `infinite` iteration and no pause control. Also `<marquee>` |
| 28 | New tab links without warning | 3.2.5 | `<a target="_blank">` with no visual indicator or aria-label mentioning "opens in new tab" |
| 29 | Reflow at 320px | 1.4.10 | During viewport scan: horizontal scroll at 320px (`scrollWidth > clientWidth`) |
| 30 | SPA route changes without focus management | 4.1.3 | URL hash/pushState changes without programmatic focus move |
| 31 | `prefers-reduced-motion` not respected | 2.3.3 | CSS animations without `@media (prefers-reduced-motion: reduce)` query |
| 32 | Target size with overlap | 2.5.8 | Virtual 24px circle on undersized targets overlapping neighboring interactive elements |
| 33 | Suspicious alt text | 1.1.1 | Alt text matching filename, containing "image of"/"photo of", or just the extension |

### Crawl-only rules

Rules 21 and 22 only run during site crawl — they compare data across pages. All other rules run on every scan.

### Result format

Heuristic results use the same `iViolation` format as axe-core results. They are merged into the main violation list, indistinguishable from axe results in the UI.

### Priority matrix

From `/docs/BEYOND-AXE-CORE-GAPS.md`, each rule is classified:
- **Full detection**: DOM/CSS only, no false positives expected
- **Partial detection**: may have false positives, flagged as "needs review"
- **Warning only**: cannot be certain, shown as informational

## Acceptance Criteria

1. All 33 heuristic rules run after axe-core scan completes.
2. Heuristic violations appear in the same violation list as axe results.
3. Heuristic violations are mapped to the correct WCAG criteria.
4. Heuristic violations have correct severity levels.
5. Crawl-only rules (21, 22) only run during site crawl.
6. Each rule can be individually enabled/disabled via test config.
7. Heuristic results are included in exports.
8. Rules that use `getComputedStyle` handle edge cases (hidden elements, pseudo-elements).

---

## Detection Algorithms

### Rule 1 — Decorative symbols without `aria-hidden`

**Pseudo-code**
```
for each element matching span, i, div, p:
  text = element.innerText.trim()
  if text matches /^[>•|→—·※◆▶◀►◄]+$/ and text.length <= 3:
    if element.getAttribute('aria-hidden') !== 'true':
      flag as violation
```

**Edge cases**
- Shadow DOM: walk shadow roots to reach slotted content; symbols inside shadow trees are equally exposed to AT.
- SVG symbols used as icon glyphs are covered by Rule 2, not this rule — skip elements containing child `<svg>`.
- Elements already hidden via `display:none` or `visibility:hidden` are inert; skip them.

**False positive handling**
- If the element has an ancestor with `aria-hidden="true"`, it is already hidden — skip.
- Single hyphen `-` is ambiguous (could be minus sign) — flag as "needs review", not definite violation.

---

### Rule 2 — Icon fonts without text alternatives

**Pseudo-code**
```
for each element in DOM:
  classes = element.classList
  if classes matches /fa-\w+|material-icons|glyphicon-\w+|bi-\w+|ion-\w+/:
    hasLabel = aria-label || aria-labelledby || title || visible non-empty text sibling
    if not hasLabel and aria-hidden !== 'true':
      flag as violation
```

**Edge cases**
- Shadow DOM: icon font elements inside shadow roots are reachable via `shadowRoot.querySelectorAll`.
- Pseudo-element rendering: icon font classes may produce the glyph via `::before` content; the element itself may have empty `innerText`. Do not rely on `innerText` alone — check classes.
- Dynamically injected icons (e.g., injected by JS after load) are caught because heuristics run after axe (post-DOMContentLoaded + idle).

**False positive handling**
- If the icon is inside an `<button>` or `<a>` that has its own `aria-label`, the icon does not need a separate label — skip.
- Flag as "needs review" if the icon has a sibling text node that is visually clipped (e.g., `sr-only` class) — this is valid but easy to miss.

---

### Rule 3 — CSS `::before`/`::after` with meaningful content

**Pseudo-code**
```
for each element in DOM:
  for pseudo in ['::before', '::after']:
    style = getComputedStyle(element, pseudo)
    content = style.content
    if content is not '' and content is not 'none' and content is not '""':
      if content is not purely decorative (not just quotes/spaces/counters):
        if element.getAttribute('aria-hidden') !== 'true':
          flag as needs-review
```

**Edge cases**
- `getComputedStyle` with pseudo-element argument returns content including surrounding quotes (e.g., `'"›"'`); strip outer quotes before evaluation.
- CSS counters (`counter(step)`) produce numeric text readable by some AT — flag as needs-review rather than definite violation.
- Elements with `display:none` still return pseudo-element styles in some browsers; check that the element itself is visible before flagging.

**False positive handling**
- Decorative content patterns (`" "`, `"/"`, `"|"`, `"·"`) — flag as "needs review" since context determines whether they are meaningful.
- Content that is a single quote character used for typographic purposes is generally decorative — skip.

---

### Rule 4 — Generic link text

**Pseudo-code**
```
GENERIC_PATTERNS = ['click here', 'read more', 'learn more', 'more', 'here', 'link', 'details', 'info']
for each <a> element:
  name = accessibleName(element).toLowerCase().trim()
  if name in GENERIC_PATTERNS or name matches /^(click|tap)\s(here|this)$/:
    flag as violation
```

**Edge cases**
- Accessible name must be computed via the full accname algorithm (aria-label > aria-labelledby > text content + alt of child images) — do not use `innerText` alone.
- Links inside `<figure>` or `<table>` may gain context from surrounding `<figcaption>` or column headers; these are within-page context, not accessible name — still flag.
- `aria-label` overriding an otherwise generic text node: if `aria-label` is meaningful, skip the violation.

**False positive handling**
- If link is the only element in a card component and the card provides visual context, flag as "needs review" — the link text alone may be inadequate for AT users.
- Link with `aria-describedby` pointing to a nearby description — flag as "needs review", not definite violation.

---

### Rule 5 — Visual order vs DOM order mismatch

**Pseudo-code**
```
for each flex/grid container:
  children = container.children (in DOM order)
  rects = children.map(el => el.getBoundingClientRect())
  domOrder = [0, 1, 2, ...]
  visualOrder = rects sorted by (top asc, left asc)
  if visualOrder indices !== domOrder:
    for each child with order != DOM position:
      flag as violation
```

**Edge cases**
- Absolutely positioned elements can appear anywhere visually; compare their `top`/`left` rect values against their DOM siblings.
- RTL layouts (`dir="rtl"`) reverse expected left-to-right visual order; check `direction` computed style before comparing horizontal positions.
- Off-screen or hidden children (rect width/height = 0) should be excluded from the visual order comparison.

**False positive handling**
- Pure decorative reordering (e.g., reversed decorative bullets) with no focusable or text content — flag as "needs review".
- CSS `order` applied only at certain breakpoints: run comparison at current viewport; for other breakpoints this is a multi-viewport rule concern (Rule 29 territory).

---

### Rule 6 — Small touch targets

**Pseudo-code**
```
INTERACTIVE = 'a, button, input, select, textarea, [role="button"], [role="link"], [tabindex]'
for each element matching INTERACTIVE:
  rect = element.getBoundingClientRect()
  if rect.width < 24 or rect.height < 24:
    flag as violation
  else if rect.width < 44 or rect.height < 44:
    flag as needs-review (below WCAG 2.5.5 enhanced)
```

**Edge cases**
- `getBoundingClientRect` returns the visual bounding box, which includes CSS `padding` but not `margin`; use it directly.
- Elements with `pointer-events: none` are non-interactive despite being in the interactive selector — check and skip.
- Inputs with `type="hidden"` have zero-size rects — skip.

**False positive handling**
- If a small element has a larger clickable ancestor (e.g., a tiny icon inside a full-width `<button>`) — walk ancestors; if a parent interactive element meets the size requirement, skip the child.
- Inline text links within paragraphs: flag as "needs review" rather than definite violation since reformatting a word-within-sentence is impractical.

---

### Rule 7 — Scroll containers without keyboard access

**Pseudo-code**
```
for each element in DOM:
  style = getComputedStyle(element)
  if style.overflow or style.overflowX or style.overflowY is 'auto' or 'scroll':
    if element.scrollHeight > element.clientHeight or element.scrollWidth > element.clientWidth:
      if element.tabIndex < 0 and element is not <body> and element is not <html>:
        flag as violation
```

**Edge cases**
- `<body>` and `<html>` are the default scroll containers; skip them — browsers make them keyboard-scrollable natively.
- Scroll containers that contain only focusable children are keyboard-accessible via tab traversal — check if at least one focusable descendant exists before flagging.
- Overflow set dynamically via JS (not in stylesheet) will be caught because `getComputedStyle` reflects the live computed value.

**False positive handling**
- Scroll containers used only for decorative overflow clipping (no actual overflow at runtime) — check `scrollHeight > clientHeight` before flagging.
- Custom scroll implementations using keyboard event listeners on the container: if the element has a `keydown` event listener attribute or `onkeydown`, flag as "needs review".

---

### Rule 8 — Missing `autocomplete` on common inputs

**Pseudo-code**
```
FIELD_MAP = {name: 'name', email: 'email', phone: 'tel', address: 'street-address', ...}
for each <input>, <textarea>:
  label = accessibleName(element).toLowerCase()
  type = element.type
  if label or name or id matches a FIELD_MAP key:
    if element.getAttribute('autocomplete') is null or 'off':
      flag as violation
```

**Edge cases**
- Match on `name`, `id`, `aria-label`, `placeholder`, and associated `<label>` text — any of these may indicate field purpose.
- Inputs inside `<form autocomplete="off">` inherit `off`; flag the field individually as the form-level override may be intentional.
- Inputs of `type="search"`, `type="hidden"`, `type="button"` are exempt — skip.

**False positive handling**
- OTP/verification code fields (detected by `autocomplete="one-time-code"` or labels containing "otp"/"verification") — these often intentionally omit autocomplete; flag as "needs review".
- Login forms with `autocomplete="off"` may be a deliberate security choice; flag as "needs review", not definite violation.

---

### Rule 9 — Focus indicator check

**Pseudo-code**
```
for each focusable element:
  blurStyle = getComputedStyle(element)           // unfocused
  element.focus()
  focusStyle = getComputedStyle(element)
  element.blur()
  changed = (focusStyle.outline !== blurStyle.outline)
          or (focusStyle.boxShadow !== blurStyle.boxShadow)
          or (focusStyle.border !== blurStyle.border)
          or (focusStyle.backgroundColor !== blurStyle.backgroundColor)
  if not changed:
    flag as violation
```

**Edge cases**
- Programmatically focusing elements causes page scroll and may trigger other effects; restore scroll position after focus.
- Elements in collapsed `<details>` or hidden `display:none` trees cannot be focused; skip non-focusable elements.
- Browser default focus rings differ by OS/browser; checking only `outline: none` misses cases — compare all focus-related properties.

**False positive handling**
- Elements styled with `:focus-visible` only (not `:focus`) will show no change when focused programmatically in some environments; flag as "needs review".
- Custom focus indicators applied via a parent container's CSS pseudo-class cannot be detected; flag elements using `:focus-within` on an ancestor as "needs review".

---

### Rule 10 — Inline `!important` on text styling

**Pseudo-code**
```
TEXT_PROPS = ['font-size', 'line-height', 'letter-spacing', 'word-spacing']
for each element with inline style attribute:
  style = element.getAttribute('style')
  for each prop in TEXT_PROPS:
    if style contains prop + ':' and '!important':
      flag as violation
```

**Edge cases**
- `!important` in stylesheets (not inline) is harder to detect via DOM APIs; use `CSSStyleDeclaration.getPropertyPriority(prop)` on the inline style object to confirm it is `"important"`.
- `element.style.getPropertyPriority('font-size')` returns `"important"` only for inline styles; stylesheet `!important` requires iterating `document.styleSheets` — limit to inline for performance.
- Elements inside iframes have their own `document`; check `iframe.contentDocument.querySelectorAll('[style]')` for iframes with same-origin content.

**False positive handling**
- Framework utility classes sometimes set inline `!important` programmatically for layout (e.g., `display: none !important`); only flag text-spacing properties.
- If the element has `user-modify: read-only` or is inside a fixed-layout PDF viewer, the override concern is moot — flag as "needs review".

---

### Rule 11 — Non-text contrast

**Pseudo-code**
```
UI_COMPONENTS = 'input, select, textarea, button, [role="checkbox"], [role="radio"], [role="switch"]'
for each element matching UI_COMPONENTS:
  borderColor = getComputedStyle(element).borderColor
  bgColor = getComputedStyle(element.parentElement).backgroundColor
  ratio = contrastRatio(borderColor, bgColor)
  if ratio < 3.0:
    flag as violation
```

**Edge cases**
- Alpha-transparent colors must be composited against the actual rendered background, which may be multiple layers deep — walk ancestors collecting `backgroundColor` until an opaque layer is found.
- Elements using `outline` as their border (common in reset stylesheets) — also check `outline-color`.
- SVG-based UI controls: read `stroke` and `fill` attributes in addition to CSS properties.

**False positive handling**
- Elements using `box-shadow` as a visible border (common design pattern) — include `box-shadow` color in the contrast check; flag as "needs review" if box-shadow provides sufficient contrast.
- High-contrast OS mode overrides computed colors; if `forced-colors: active` media is matched, skip this rule.

---

### Rule 12 — Placeholder as only label

**Pseudo-code**
```
for each <input>, <textarea>:
  if element.hasAttribute('placeholder'):
    hasLabel = (associated <label> element exists)
             or element.getAttribute('aria-label')
             or element.getAttribute('aria-labelledby')
             or element.getAttribute('title')
    if not hasLabel:
      flag as violation
```

**Edge cases**
- `<label for="id">` association: look up `document.querySelector('label[for="' + element.id + '"]')` — check both `for` attribute and wrapping `<label>` ancestor.
- `aria-labelledby` pointing to an element that itself has only placeholder-like text — this is a deeper semantic issue; flag the original element as violation regardless.
- Inputs of `type="hidden"`, `type="submit"`, `type="reset"`, `type="button"` do not require labels — skip.

**False positive handling**
- Search inputs (type="search" or role="searchbox") with a visible search button that implies context — flag as "needs review".
- If the input is inside a `<fieldset>` with a descriptive `<legend>`, the placeholder may be acceptable in context — flag as "needs review".

---

### Rule 13 — Visual headings without semantic markup

**Pseudo-code**
```
bodyFontSize = parseFloat(getComputedStyle(document.body).fontSize)
for each <p>, <div>, <span>, <li>, <td>:
  style = getComputedStyle(element)
  fontSize = parseFloat(style.fontSize)
  fontWeight = style.fontWeight
  text = element.innerText.trim()
  if text.length > 0 and text.length < 200:
    if fontSize >= bodyFontSize * 1.5 or fontWeight >= 700:
      if element.tagName not in H1-H6 and element.getAttribute('role') !== 'heading':
        flag as needs-review
```

**Edge cases**
- Font size inheritance: a `<span>` inside a large `<p>` inherits the font size — compute on the element itself, not inherited values (both are `getComputedStyle` results; they are already resolved).
- `em`/`rem` units are resolved to `px` by `getComputedStyle` — no unit conversion needed.
- Navigation items and list labels styled large are intentional — check `<nav>` ancestor and flag as "needs review" rather than definite violation.

**False positive handling**
- Pull quotes, callout boxes, hero text — large text for emphasis, not as heading; flag as "needs review".
- Single words or very short text (1-2 characters) that are large (e.g., section letters in an A-Z index) — skip if `text.length < 3`.

---

### Rule 14 — Heading tags used for styling

**Pseudo-code**
```
bodyFontSize = parseFloat(getComputedStyle(document.body).fontSize)
for each h1, h2, h3, h4, h5, h6:
  style = getComputedStyle(element)
  headingFontSize = parseFloat(style.fontSize)
  if headingFontSize <= bodyFontSize:
    flag as violation
  parentBlock = closest block-level ancestor
  if element is inline within a <p> (parentBlock is <p>):
    flag as violation
```

**Edge cases**
- CSS resets (Normalize.css, CSS Reset) may globally reduce heading sizes; check multiple headings of the same level before concluding — if more than 50% of `<h2>` elements are undersized, it is likely a site-wide reset pattern.
- Headings with `display:inline` are suspicious but not always wrong (e.g., in definition lists); flag as "needs review".
- `<h1>`–`<h6>` inside `<table>` cells used for layout heading are a real pattern; flag as violation.

**False positive handling**
- Headings intentionally de-emphasized (e.g., "Section" label for a visually subordinate block) — flag as "needs review" if font-size is within 10% of body font.
- Headings inside `<details>`/`<summary>` elements where reduced sizing is intentional — flag as "needs review".

---

### Rule 15 — Links indistinguishable from text

**Pseudo-code**
```
for each <a> inside <p>, <li>, <td>, <dd>:
  linkStyle = getComputedStyle(element)
  parentStyle = getComputedStyle(element.parentElement)
  hasUnderline = linkStyle.textDecoration includes 'underline'
  hasBold = linkStyle.fontWeight > parentStyle.fontWeight
  hasItalic = linkStyle.fontStyle !== parentStyle.fontStyle
  ratio = contrastRatio(linkStyle.color, parentStyle.color)
  if not hasUnderline and ratio < 3.0 and not hasBold and not hasItalic:
    flag as violation
```

**Edge cases**
- Links that are the only content in their parent (no surrounding text) do not need to be distinguishable from adjacent text — skip if no text siblings exist.
- CSS `text-decoration-color` may differ from the link color; check `text-decoration-line` specifically for `underline`.
- Hover/focus styles alone do not count — evaluate resting state only.

**False positive handling**
- Navigation links in `<nav>` menus where the container itself is visually distinct (background, border) from body text — flag as "needs review".
- Links styled as buttons (`display:block`, colored background) — they are visually distinct via background, not text decoration; skip if `backgroundColor !== parentStyle.backgroundColor`.

---

### Rule 16 — Div/span as button

**Pseudo-code**
```
for each div, span, li, td:
  if element has onclick attribute or addEventListener('click') evidence:
    role = element.getAttribute('role')
    tabIndex = element.tabIndex
    hasKeyHandler = element has onkeydown or onkeypress or onkeyup attribute
    if role not in ['button', 'link', 'menuitem', ...] and tabIndex < 0:
      flag as violation
    else if role === 'button' and not hasKeyHandler and tabIndex < 0:
      flag as violation (missing keyboard handler)
```

**Edge cases**
- Inline event handlers are detectable via `element.onclick !== null`; addEventListener-bound handlers are not directly detectable — use the presence of cursor:pointer as a heuristic proxy.
- `cursor: pointer` computed style is a strong but imperfect signal for clickability; combine with other signals (background hover change, shadow).
- Elements acting as drag handles or resize controls may have click handlers for non-button purposes — flag as "needs review".

**False positive handling**
- Delegated event listeners on parent containers make child `<div>` elements appear clickable; flag as "needs review" if the element itself has no direct handler.
- Custom web components (`<my-button>`) may internally render a `<div>` with ARIA — check the shadow DOM for `role="button"` before flagging the host element.

---

### Rule 17 — Focus removal (`outline: none`)

**Pseudo-code**
```
for each element that is focusable:
  element.focus()
  style = getComputedStyle(element)
  outlineWidth = parseFloat(style.outlineWidth)
  outlineStyle = style.outlineStyle
  element.blur()
  if outlineWidth === 0 or outlineStyle === 'none':
    hasBoxShadow = style.boxShadow !== 'none'
    hasBorderChange = (focused border !== unfocused border)
    hasBackgroundChange = (focused bg !== unfocused bg)
    if not hasBoxShadow and not hasBorderChange and not hasBackgroundChange:
      flag as violation
```

**Edge cases**
- Browsers may inject UA focus ring that `getComputedStyle` does not reflect (especially in Firefox); this rule may under-report on Firefox — document this limitation.
- Elements styled with `:focus-visible` only: programmatic `focus()` triggers `:focus` but not always `:focus-visible`; check both pseudo-class styles.
- Same-page focus() calls cause scroll; batch them carefully and restore `scrollY` after each.

**False positive handling**
- Custom focus rings applied via parent `:focus-within` — the element itself shows `outline:none` but the parent adds a ring; flag as "needs review".
- SVG elements and canvas: standard outline does not apply; if a custom focus indicator is present in the canvas/SVG layer, this cannot be auto-detected — flag as "needs review".

---

### Rule 18 — `aria-hidden` with focusable children

**Pseudo-code**
```
FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
for each element with aria-hidden="true":
  focusableDescendants = element.querySelectorAll(FOCUSABLE)
  if focusableDescendants.length > 0:
    flag as violation with list of focusable children
```

**Edge cases**
- Shadow DOM: `querySelectorAll` does not pierce shadow roots — must also check `element.shadowRoot` if present and walk recursively.
- `tabindex="-1"` elements are programmatically focusable but not in tab order; only flag elements with `tabindex >= 0` or natural focusability.
- `<details>` elements: the `<summary>` is naturally focusable; check if `<details>` itself is under an `aria-hidden` ancestor.

**False positive handling**
- Modals that are hidden (aria-hidden="true") when closed but contain focusable elements — if `display:none` is also applied, AT cannot reach them anyway; check visibility before flagging.
- Custom focus traps that intentionally hide the rest of the page with `aria-hidden` while a modal is open — this is the correct pattern; do not flag elements where the `aria-hidden` parent is also the `inert` container.

---

### Rule 19 — Broken ARIA references

**Pseudo-code**
```
REF_ATTRS = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-owns', 'aria-activedescendant']
for each element in DOM:
  for each attr in REF_ATTRS:
    value = element.getAttribute(attr)
    if value:
      ids = value.split(' ')
      for each id in ids:
        if not document.getElementById(id):
          flag as violation (broken reference to id)
```

**Edge cases**
- IDs containing spaces are invalid HTML; split the attribute value on whitespace and validate each token.
- Dynamic content: an ID may not exist at scan time but be added later; flag at scan time with a note that dynamic content may affect this.
- Shadow DOM: `getElementById` searches only the light DOM; IDs inside shadow roots are not reachable — flag as "needs review" if the referencing element is inside a shadow root.

**False positive handling**
- IDs deliberately omitted and added asynchronously (lazy-loaded descriptions) — flag as violation since AT users may encounter the element before the target renders.
- `aria-controls` on accordion buttons pointing to a panel that starts hidden — the element exists in the DOM even if not visible; valid reference, do not flag.

---

### Rule 20 — Focus obscured by sticky headers

**Pseudo-code**
```
stickyEls = querySelectorAll('[style*="position: fixed"], [style*="position: sticky"]')
           + computed-style scan for position:fixed/sticky elements
for each focusable element:
  element.focus()
  focusedRect = element.getBoundingClientRect()
  for each stickyEl:
    stickyRect = stickyEl.getBoundingClientRect()
    if rectsOverlap(focusedRect, stickyRect):
      flag as violation
element.blur()
```

**Edge cases**
- Scroll position changes after focus: some browsers scroll to reveal the focused element before the next `getBoundingClientRect` call — add a short `requestAnimationFrame` delay before measuring.
- Sticky elements that are transparent or use `pointer-events:none` still occlude visual focus even if not interactive — check visual overlap, not pointer-events.
- Multiple sticky headers (e.g., a sticky nav + a sticky sub-nav) — check against all fixed/sticky elements.

**False positive handling**
- Focused elements fully below the sticky header with no overlap — recheck rect coordinates carefully; account for borders/padding.
- Sticky sidebars (left/right fixed panels) — also check horizontal overlap, not just top sticky headers.

---

### Rule 21 — Inconsistent navigation order (crawl-only)

**Pseudo-code**
```
// Runs per-page during crawl; comparison happens post-crawl
perPage[url] = extractNavLinks(document.querySelector('nav'))  // ordered list of hrefs

// Post-crawl comparison:
for each pair of pages:
  navA = perPage[urlA], navB = perPage[urlB]
  commonLinks = intersection(navA, navB)
  orderA = commonLinks.map(link => navA.indexOf(link))
  orderB = commonLinks.map(link => navB.indexOf(link))
  if orderA !== orderB:
    flag as violation on pages that differ from majority order
```

**Edge cases**
- Multiple `<nav>` elements per page: extract all; match by `aria-label` across pages to compare equivalent nav blocks.
- Dynamic nav (hamburger menu rendered differently per breakpoint): compare only when nav is in its desktop (expanded) state.
- Pages with login-gated nav items will have different nav structures — compare only publicly accessible pages or mark as "needs review".

**False positive handling**
- A-Z navigation (alphabetical listing) that legitimately differs from a top-level nav — detect if links are sorted alphabetically and skip the comparison for those nav blocks.
- Tabs or pagination nav that reflects page-specific state — if `aria-current` is present on one link, treat it as a state indicator not a structural difference.

---

### Rule 22 — Inconsistent link identification (crawl-only)

**Pseudo-code**
```
// Per-page during crawl:
for each <a href="...">:
  record { href: normalizedHref, accessibleName: computedName, url: pageUrl }

// Post-crawl comparison:
group records by normalizedHref
for each group:
  names = unique accessible names in group
  if names.length > 1:
    flag as violation listing all differing names and source pages
```

**Edge cases**
- Relative vs absolute URLs: normalize to absolute href before grouping.
- Hash fragments: `page.html#section` and `page.html` are different destinations — compare full normalized URL including fragment.
- Links that deliberately use different text for the same URL (e.g., "Home" and "Go to homepage") are a real violation of 3.2.4 — do not suppress them.

**False positive handling**
- Language variants: if the site serves multiple languages and link text differs by language, suppress if the `lang` attribute differs between pages.
- `aria-label` overrides that are context-appropriate (e.g., "Edit Naruto's profile" vs "Edit Gandalf's profile" for the same `/edit` route) — these are different accessible names for contextually different purposes; flag as "needs review".

---

### Rule 23 — Show password toggle detection

**Pseudo-code**
```
for each <input type="password">:
  parent = element.closest('form, [role="form"], div, section')
  toggle = parent.querySelector('button, [role="button"], input[type="checkbox"]')
           filtered by: text/label contains 'show', 'hide', 'reveal', 'toggle'
  if not toggle:
    flag as needs-review
```

**Edge cases**
- Toggles implemented as icon-only buttons (eye icon) with no text — check `aria-label` of nearby buttons for reveal-related keywords.
- Password fields added dynamically (e.g., step 2 of a wizard) — the heuristic runs post-load, so they are present; scan the full DOM.
- Confirm-password fields: apply the same check; each password input should have its own accessible toggle.

**False positive handling**
- Password managers inject their own reveal UI; if the extension context detects a password-manager-injected element, skip the flag.
- `autocomplete="current-password"` fields on login forms are commonly managed by the browser itself — flag as "needs review" rather than definite violation.

---

### Rule 24 — Breadcrumb validation

**Pseudo-code**
```
BREADCRUMB_SIGNALS = ['breadcrumb', 'crumb', 'you are here']
for each <nav> or element with role="navigation":
  label = (aria-label or aria-labelledby resolved text).toLowerCase()
  if label matches BREADCRUMB_SIGNALS or contains ordered list of links:
    if not element.getAttribute('aria-label'):
      flag: missing aria-label
    lastLink = last <a> or <li> in the breadcrumb
    if not lastLink.getAttribute('aria-current'):
      flag: missing aria-current="page"
```

**Edge cases**
- Breadcrumbs implemented as plain `<ol>/<ul>` without a wrapping `<nav>`: detect by structural pattern (list of links with separators) and flag the missing `<nav>`.
- JSON-LD breadcrumb schema is for search engines only; it does not satisfy the HTML accessibility requirement — do not use its presence to skip the rule.
- Single-item breadcrumb (home page) — `aria-current="page"` still required on the single item.

**False positive handling**
- Step indicators / progress bars that look like breadcrumbs structurally — check if links are all `<a>` tags pointing to different pages; if they are static `<span>` elements, they are a progress indicator, not a breadcrumb. Flag as "needs review".

---

### Rule 25 — No visible label (icon-only buttons)

**Pseudo-code**
```
for each button, [role="button"], a[href]:
  hasAriaLabel = element.getAttribute('aria-label') or aria-labelledby resolved
  visibleText = element.innerText.trim()
  if hasAriaLabel and not visibleText:
    flag as needs-review (icon-only — label exists but no visible text)
  if not hasAriaLabel and not visibleText:
    flag as violation (no label at all — separate from this rule, overlap with Rule 2)
```

**Edge cases**
- `visually-hidden` / `sr-only` clipped text is in `innerText` but has zero visual size — check `getBoundingClientRect` width/height to confirm text has visual presence.
- SVG `<title>` inside a button provides an accessible name in some AT — check for `<svg><title>` as an alternative to `aria-label`.
- Tooltip-triggered labels (shown on hover) do not count as visible labels for WCAG 2.5.3 compliance — do not suppress the flag for tooltip-only labeling.

**False positive handling**
- Buttons where icon + `aria-label` is the intended design (common pattern) — this rule is informational/needs-review by definition; the pattern is not a violation per WCAG unless the `aria-label` differs from any visible text (WCAG 2.5.3 failure).
- Icon buttons with `title` attribute — title is visible on hover but not keyboard/touch accessible; flag as "needs review".

---

### Rule 26 — Carousel accessibility

**Pseudo-code**
```
CAROUSEL_SIGNALS = ['.carousel', '.slider', '[data-ride="carousel"]', '[role="region"][aria-roledescription]']
for each element matching CAROUSEL_SIGNALS or detected by structural pattern:
  hasPrev = querySelector('[aria-label*="previous"], [aria-label*="prev"], .carousel-prev')
  hasNext = querySelector('[aria-label*="next"], .carousel-next')
  hasPagination = querySelectorAll('[role="tab"], .dot, .indicator').length > 0
  hasLiveRegion = querySelector('[aria-live]')
  if not hasPrev or not hasNext:
    flag: missing navigation controls
  if hasPagination and paginationItems lack aria-label:
    flag: pagination items not labeled
  if not hasLiveRegion:
    flag: no live region for slide announcements
```

**Edge cases**
- Carousels implemented with CSS scroll snap and no JS wrapper: detect by `scroll-snap-type` on a container with multiple children.
- Auto-advancing carousels without a pause button violate Rule 27 (animation) as well — cross-reference but flag separately.
- Carousels inside shadow DOM: query within the shadow root; the host element itself may expose slots.

**False positive handling**
- Static image galleries without auto-advance that are keyboard-navigable via tab — may not require prev/next buttons if individual items are all focusable; flag as "needs review".

---

### Rule 27 — Auto-playing/infinite animation

**Pseudo-code**
```
for each element in DOM:
  style = getComputedStyle(element)
  if style.animationIterationCount === 'infinite' and style.animationPlayState === 'running':
    pauseButton = document.querySelector('[aria-label*="pause"], [aria-label*="stop"]')
    if not pauseButton:
      flag as violation
  if element.tagName === 'MARQUEE':
    flag as violation
  checkPrefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if checkPrefersReducedMotion and style.animationDuration !== '0s':
    flag as violation (Rule 31 overlap — cross-reference)
```

**Edge cases**
- CSS transitions (not animations) that loop via JS: `getComputedStyle` will not catch these; look for `transition` with repeated JS-driven class toggling — this is beyond static DOM analysis; document as a limitation.
- `animation-play-state: paused` set on load (animation paused by default): skip elements where the animation starts paused.
- `<video autoplay loop>` is covered by WCAG SC 1.4.2 / Rule checks in axe-core; skip video elements here.

**False positive handling**
- Loading spinners: infinite animation is intentional; if element has `role="status"` or is inside a loading overlay, flag as "needs review".
- Animated icons used as decorative elements (e.g., waving hand emoji animation) — if `aria-hidden="true"`, flag as "needs review" rather than violation.

---

### Rule 28 — New tab links without warning

**Pseudo-code**
```
for each <a target="_blank"> or <a target="_new">:
  label = accessibleName(element).toLowerCase()
  hasWarning = label includes 'new tab' or 'new window' or 'opens in'
  hasIcon = element.querySelector('[aria-label*="new tab"], [title*="new tab"]')
  hasRelNoopener = element.getAttribute('rel') includes 'noopener' (security, not a11y signal)
  if not hasWarning and not hasIcon:
    flag as violation
```

**Edge cases**
- `aria-label` that mentions new tab counts as warning — but `title` attribute is only shown on hover, not reliably surfaced by all AT; do not count `title` alone as sufficient.
- Links that open new tabs via JS (`window.open`) rather than `target="_blank"` — these cannot be detected statically; document as a limitation.
- Icons with `aria-label="opens in new tab"` as a child of the link contribute to the accessible name computation — check computed accessible name, not just direct `aria-label`.

**False positive handling**
- External links that do open in a new tab but the decision is made at the server/middleware level — at DOM scan time, if `target="_blank"` is present, flag regardless.
- Print links (`href="javascript:window.print()"`) — these do not open a new tab; skip elements where href is a javascript: URI.

---

### Rule 29 — Reflow at 320px (viewport scan only)

**Pseudo-code**
```
// Runs during viewport scan at 320px width
if window.innerWidth <= 320:
  for each block-level element and scroll container:
    if element.scrollWidth > document.documentElement.clientWidth:
      flag as violation with element reference
  // Also check document-level
  if document.documentElement.scrollWidth > 320:
    flag as page-level violation
```

**Edge cases**
- This rule only runs when the viewport is set to 320px (multi-viewport scan mode); skip during regular scan.
- Horizontal scrolling caused by `<pre>` code blocks is expected and should be flagged as "needs review" — code blocks often cannot reflow.
- Fixed-width SVG or `<canvas>` elements cause horizontal scroll but may be acceptable if they have a scroll container — check if overflow is contained.

**False positive handling**
- Intentional horizontal scroll components (data tables, timelines) that have their own scroll container (overflow-x:auto on a wrapper) — if the overflow is contained within a designated container, skip the page-level flag but still flag the element.
- Maps and iframes that have fixed aspect ratios — flag as "needs review".

---

### Rule 30 — SPA route changes without focus management

**Pseudo-code**
```
// Instrument history API before scan:
originalPushState = history.pushState
history.pushState = function(...args):
  originalPushState.apply(this, args)
  recordRouteChange(args[2])  // new URL

// After each route change, check:
onRouteChange():
  setTimeout(100ms):
    if document.activeElement === document.body or document.activeElement === null:
      flag as violation (focus not moved after route change)
    if not document.querySelector('[aria-live]') received update:
      flag as needs-review (no live region announcement)
```

**Edge cases**
- Hash-only changes (`#section`) may be intentional anchor navigation — only flag if the hash changes to a new route pattern (e.g., `#/users/1` to `#/users/2`).
- Frameworks that use `<Suspense>` or async loading may move focus after a delay longer than 100ms; use a 500ms timeout or observe `MutationObserver` for main content changes.
- Server-side rendered pages with full page reloads (not SPAs) — `pushState` is not used; this rule only fires on SPA navigation.

**False positive handling**
- Route changes that intentionally focus a skip-link or `<h1>` — `document.activeElement` will not be `<body>` after those; do not flag.
- Tab panels implemented via URL hash that update content in-place — if focus stays on the tab control itself, that is acceptable; do not flag if `document.activeElement` is a tab button.

---

### Rule 31 — `prefers-reduced-motion` not respected

**Pseudo-code**
```
animatedElements = querySelectorAll elements where getComputedStyle has non-zero animation-duration or transition-duration
for each animatedElement:
  hasReducedMotionOverride = false
  for each CSSStyleSheet in document.styleSheets:
    for each CSSMediaRule matching 'prefers-reduced-motion: reduce':
      for each rule in media block:
        if rule.selectorText matches animatedElement:
          if rule sets animation-duration: 0s or animation: none:
            hasReducedMotionOverride = true
  if not hasReducedMotionOverride:
    flag as violation
```

**Edge cases**
- Cross-origin stylesheets throw `SecurityError` on `cssRules` access — wrap in try/catch and skip cross-origin sheets; document this limitation.
- Inline `style` attributes do not respond to media queries — if an element has an inline animation, it will never respect `prefers-reduced-motion` via CSS; flag as violation.
- JS-driven animations (GSAP, anime.js) are not detectable via stylesheet parsing; document as a limitation.

**False positive handling**
- Animations that are purely `opacity` transitions (fade in/out) are generally acceptable under reduced motion guidelines — flag as "needs review" rather than violation.
- `prefers-reduced-motion: no-preference` is the default; some authors explicitly set it — skip elements that already have `animation-duration: 0s` in their base styles.

---

### Rule 32 — Target size with overlap

**Pseudo-code**
```
INTERACTIVE = 'a, button, input, select, [role="button"], [role="link"], [tabindex]'
for each element matching INTERACTIVE:
  rect = element.getBoundingClientRect()
  cx = rect.left + rect.width / 2
  cy = rect.top + rect.height / 2
  radius = 12  // half of 24px minimum
  virtualCircle = { cx, cy, radius }
  neighbors = other interactive elements within 48px
  for each neighbor:
    neighborRect = neighbor.getBoundingClientRect()
    if circleOverlapsRect(virtualCircle, neighborRect):
      if not (element is part of the same component as neighbor):
        flag as violation
```

**Edge cases**
- Elements that are visually separate but share a parent container — check if they are siblings in the same interactive group (e.g., radio buttons in a group) and apply WCAG exception for grouped controls.
- Off-screen elements (rect is off-viewport) may have zero coordinates — skip elements with `rect.width === 0`.
- Floating elements (tooltips, popovers) that appear near the target at runtime — these are not in the DOM simultaneously; skip dynamically-shown overlays.

**False positive handling**
- Adjacent same-type controls that are intentionally close (e.g., toolbar buttons) — WCAG 2.5.8 exception applies when offset is provided by the author; if the container has explicit spacing CSS, flag as "needs review".
- Dense data table cells with interactive content — flag as "needs review" with a note that table contexts have limited layout flexibility.

---

### Rule 33 — Suspicious alt text

**Pseudo-code**
```
FILE_EXT_PATTERN = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico)$/i
FILENAME_PATTERN = /^(img|image|photo|picture|screenshot|icon|logo|banner|thumbnail)[-_\d]*/i
REDUNDANT_PREFIX = /^(image of|photo of|picture of|graphic of|screenshot of)/i

for each <img>:
  alt = element.getAttribute('alt')
  if alt is null:
    skip (covered by axe-core missing-alt rule)
  if alt === '':
    skip (intentionally decorative)
  if FILE_EXT_PATTERN.test(alt):
    flag as violation (alt matches file extension)
  if FILENAME_PATTERN.test(alt):
    flag as violation (alt is a filename)
  if REDUNDANT_PREFIX.test(alt):
    flag as violation (redundant "image of" prefix)
  src = element.getAttribute('src')
  filename = src.split('/').pop().replace(FILE_EXT_PATTERN, '')
  if alt.toLowerCase() === filename.toLowerCase():
    flag as violation (alt matches filename)
```

**Edge cases**
- Data URIs as `src`: no filename to compare; skip the filename-match check.
- Dynamically generated `src` values (blob URLs, CDN URLs with hash filenames): the filename may be a hash; do not flag if the filename is purely alphanumeric hash-like (`/[a-f0-9]{8,}/`).
- `<picture>` elements: check the `alt` on the `<img>` child, not the `<source>` elements.

**False positive handling**
- Product codes or identifiers as alt text (e.g., alt="SKU-12345") — these may be meaningful in e-commerce context; flag as "needs review".
- Logo alt text matching the brand name also matching the filename (e.g., alt="Acme" src="acme-logo.png") — filename contains the alt text as a substring; only flag if they are an exact match, not a substring match.
