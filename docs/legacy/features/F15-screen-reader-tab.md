# F15 — Screen Reader Tab

## Purpose

A top-level tab showing every element on the page in the order a screen reader encounters them (DOM order, respecting aria-hidden, display:none, aria-owns). Lets users understand the screen reader experience without needing an actual screen reader.

## Dependencies

- None (independent top-level tab)

## Behavior

### Tab location

Second top-level tab: Scan | **Screen Reader** | Keyboard | AI Chat.

Disabled when a scan/crawl is actively running (per PHASE_MODE_CHART.md Chart 2). Always accessible otherwise.

### Initial state

Button: "**Analyze**" — runs the screen reader analysis on the current page.

### Analysis process

1. Content script walks the DOM in reading order:
   - Follows DOM order.
   - Skips elements with `aria-hidden="true"` and their descendants.
   - Skips elements with `display: none` or `visibility: hidden`.
   - Respects `aria-owns` (reorders owned elements to appear after the owner).
2. For each element, computes:
   - **Accessible name**: via `aria-label`, `aria-labelledby`, `<label>`, `title`, `alt`, visible text content.
   - **Role**: ARIA role or implicit role from element type (button, link, heading, etc.).
   - **States**: expanded, checked, required, disabled, selected, pressed, current, etc.
3. Returns ordered list to side panel.

### Element list

Each row shows:
- Computed accessible name (primary text, bold)
- Role badge (e.g., `button`, `link`, `heading`, `img`)
- States (e.g., "expanded", "checked", "required") as small badges
- **Speak button** (🔊 icon with proper button treatment — padding, background, aria-label)

Row height: ~30px to maximize visible elements (not 45px — per UI_MISTAKES_AND_RULES.md).

### Click to highlight

Clicking any row (not the speak button) highlights the element on the page using F07 element highlighting.

### Speak button

Uses browser `SpeechSynthesis` API to speak the element's accessible name + role + states.

**Always visible** on every row. Not hidden behind hover.

**Container speak (scoped)** — Clicking the speak button on a container element (navigation, banner, region, contentinfo, complementary, article, form, list, group, main) reads the container's name AND all child elements within that container's subtree only. The scoped reading order is fetched fresh from the content script via `ANALYZE_READING_ORDER` with `scopeSelector` so the speech does NOT continue past the container's boundary.

Example: speak on `<nav>` containing 4 links reads: *"navigation, Site nav. link, Home. link, About. link, Pricing. link, Contact."*

**Non-container speak** — Clicking speak on a non-container element (link, button, heading, img, etc.) reads only that element's role, name, and states.

**Single speak interaction:**
1. **Click speak button** — speech starts, the clicked row highlights amber, the top toolbar shows Pause + Stop icons with "Speaking element X" status.
2. **Pause** — speech pauses; toolbar shows Resume + Stop icons with "Paused element X" status; row stays highlighted.
3. **Resume** — speech continues from where it paused.
4. **Stop** — speech cancelled, row de-highlighted, toolbar returns to idle Play All button.
5. **Speech naturally ends** — row de-highlighted, toolbar returns to idle Play All button.

Only one speech is active at a time. Clicking a new speak button cancels any in-progress speech first.

**Voices loading** — Chrome loads voices asynchronously. If `getVoices()` returns empty on first call, listens for `onvoiceschanged` and retries.

### Top toolbar — single inline bar (no UI bleeping)

The toolbar at the top of the elements list is **always present** with the same layout — only its content changes. UI does NOT appear/disappear (WCAG 3.2.2 Predictable):

| State | Left side (status) | Right side (controls) |
|---|---|---|
| Idle | "X elements in reading order" | ▶ Play All |
| Playing (Play All) | "Playing X of Y" amber | ⏸ Pause + ⏹ Stop |
| Paused (Play All) | "Paused at X of Y" amber | ▶ Resume + ⏹ Stop |
| Speaking (single) | "Speaking element X" amber | ⏸ Pause + ⏹ Stop |
| Paused (single) | "Paused element X" amber | ▶ Resume + ⏹ Stop |
| Complete | "Complete" green | ▶ Play All |

All control buttons are icon-only (▶ ⏸ ⏹) with proper `aria-label`s ("Play all", "Pause speech", "Resume speech", "Stop speech"). Background tint changes to amber `#fffbeb` when speech is active.

Pressing **Escape** at any time stops playback (same as clicking Stop).

### Active row highlighting

The side panel ALWAYS visually shows which row is currently active. Highlighting priority:

1. **Single speak active** → that row highlighted (amber background)
2. **Play All active** → current `playIndex` row highlighted
3. **Recent row click** → clicked row highlighted for 3 seconds (matches the F07 page glow duration)

When stop is pressed or playback ends, all highlighting clears.

### Row interaction

Each element row is **clickable**:
- Clicking a row highlights the corresponding element on the page (F07 element highlighting — scroll into view, 3-second amber glow).
- Clicking a row ALSO highlights that row in the side panel for 3 seconds, so you can track what you clicked.
- Keyboard Enter/Space on a focused row triggers the same action.
- Hover state: subtle background change (zinc-50) to indicate clickability.
- Cursor: pointer.
- Each row has `role="button"`, `tabindex="0"`, `aria-label`.
- During Play All, clicking a row does NOT interrupt playback — it just highlights that element on the page (and the row temporarily).

### Inspect Element (scope selector)

An **Inspect** button in the toolbar lets the user pick a specific region of the page to read, instead of reading the entire page.

**How it works:**

1. User clicks the **Inspect** button (crosshair/target icon) in the Screen Reader tab toolbar.
2. The button enters "active" state (highlighted, pulsing) — indicating inspect mode is on.
3. On the page, hovering over elements shows a blue dashed outline around whatever block the cursor is over (similar to DevTools element inspection).
4. User clicks an element on the page — that element becomes the **scope root**.
5. The Screen Reader tab now shows ONLY the reading order within that element's subtree, not the entire page.
6. A **scope indicator** appears below the toolbar: "Scoped to: `<nav class="main-nav">` · [Clear scope]"
7. Clicking "Clear scope" returns to full page reading order.
8. The element count updates to reflect the scoped subset (e.g., "5 elements in scope").

**Scope persists** until cleared or until Clear is clicked (which clears scope and re-reads the full page).

**In the mockup:** clicking Inspect toggles a "scoped" state that filters the element list to a subset (simulating picking a `<nav>` or `<section>`). A scope indicator bar appears showing the scoped selector.

### Clear

The **Clear** button resets the element tree and clears any active scope. Use it when the page has changed (user opened modals, expanded accordions, navigated SPAs) and a fresh analysis is needed.

### Accessible name source

Each element row shows a small **source tag** next to the accessible name indicating where the name was computed from. This helps developers understand how screen readers derive the name and debug naming issues.

| Source | Tag shown | Meaning |
|---|---|---|
| `aria-label` | `aria-label` | Name comes from `aria-label` attribute |
| `aria-labelledby` | `labelledby` | Name comes from referenced element(s) via `aria-labelledby` |
| `alt` | `alt` | Name comes from `alt` attribute (images) |
| `label` | `<label>` | Name comes from an associated `<label>` element |
| `title` | `title` | Name comes from `title` attribute |
| `contents` | `text` | Name comes from visible text content |
| `sr-only` | `sr-only` | Name comes from a visually hidden element (`.sr-only`, `clip`, `clip-path`, etc.) |

The source tag is displayed as a small muted badge (e.g., gray text) after the accessible name.

### Container element speech

When a container element (navigation, region, list, group, banner, etc.) is spoken via the speak button:
1. The element's own role and accessible name are spoken first.
2. Then all child elements within the container are spoken in reading order, with their roles and names.

This matches how a screen reader actually traverses a container — it announces the container, then reads through its contents.

Example: clicking speak on a `navigation` element with label "Site navigation" containing links "Writing", "About", "Now":
> "navigation, Site navigation. link, Writing. link, About. link, Now."

### Data structures

```typescript
interface iScreenReaderElement {
  index: number;
  selector: string;
  accessibleName: string;
  nameSource: "aria-label" | "aria-labelledby" | "alt" | "label" | "title" | "contents" | "sr-only";
  role: string;
  states: string[];           // ["expanded", "required", etc.]
  level?: number;             // heading level (1-6)
  childCount?: number;        // for groups/lists
}
```

## Acceptance Criteria

1. Screen Reader tab is a top-level tab with its own vertical space.
2. "Analyze" button runs the screen reader analysis.
3. Elements are listed in reading order (DOM order, respecting aria-hidden, display:none, aria-owns).
4. Each row shows accessible name, role, and states.
5. Clicking a row highlights the element on the page (scroll + 3s amber glow).
6. Rows have hover state (bg change) and pointer cursor to indicate clickability.
7. Speak button uses SpeechSynthesis to announce the element.
8. "Play All" starts sequential playback with the current element highlighted in the list.
9. During playback, Pause and Stop buttons replace "Play All".
10. Pause freezes playback at current element. Resume continues from there.
11. Stop returns to idle state.
12. Progress shows "Playing X of Y" or "Paused at X of Y".
13. Escape key stops playback.
14. Playback auto-returns to idle on completion.
15. Clear button resets the tree and clears scope.
16. Row height is ~30px for density.
17. Role badges have consistent width (min-width).
18. Speak buttons have proper treatment (padding, bg, aria-label) — not bare emoji.
19. Tab is disabled during scanning/crawling.
20. Inspect button activates scope selection mode.
21. Clicking an element on the page scopes the list to that subtree.
22. Scope indicator shows the scoped selector with a "Clear scope" action.
23. Clearing scope returns to full page reading order.
24. Element count updates to reflect scoped subset.
25. All UI fits within 360px.
