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

Uses browser `SpeechSynthesis` API to speak the element's accessible name + role + states (e.g., "link, Skip to main content" or "button, Shipping Policy, expanded").

**Always visible** on every row. Not hidden behind hover.

**States:**

1. **Idle** — speaker icon (🔊). Click to start speaking.
2. **Speaking** — icon changes to **Pause** button. The row text changes to show the quoted screen reader output in amber, pulsing. Click to pause speech.
3. **Paused** — icon changes to **Resume** button. Click to resume. A **Stop** button also appears to cancel entirely.

Only one element can be speaking at a time. Starting speech on a different element stops the current one.

**Visual feedback:**
- Speaking state: row shows quoted text ("role, name, states") in amber with pulse animation
- The speak button transforms to pause/stop controls
- Screen reader output is visible even if audio fails

**Voices loading** — Chrome loads voices asynchronously. If `getVoices()` returns empty on first call, listens for `onvoiceschanged` and retries.

### Play All — Playback Controls

"Play All" reads through the entire page sequentially. When playing, the button row transforms into a full playback control bar:

**Idle state** (before playing):
- "Play All" button (right-aligned, next to element count)

**Playing state**:
- **Pause** button — pauses speech and highlighting at the current element
- **Stop** button — stops playback entirely, returns to idle state
- **Progress text**: "Playing X of Y" (monospace, shows current element index)
- Current element row is visually highlighted (amber background) in the list

**Paused state**:
- **Resume** button — continues from where it paused
- **Stop** button — stops and returns to idle
- **Progress text**: "Paused at X of Y"

**Complete state** (reached end):
- Returns to idle state automatically
- Brief "Complete" message shown for 2 seconds

Pressing **Escape** at any time stops playback (same as clicking Stop).

### Row interaction

Each element row is **clickable**:
- Clicking a row highlights the corresponding element on the page (F07 element highlighting — scroll into view, 3-second amber glow).
- Hover state: subtle background change (zinc-50) to indicate clickability.
- Cursor: pointer.
- During Play All, clicking a row does NOT interrupt playback — it just highlights that element on the page.

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

**Scope persists** until cleared or until Rescan is clicked (which clears scope and re-reads the full page).

**In the mockup:** clicking Inspect toggles a "scoped" state that filters the element list to a subset (simulating picking a `<nav>` or `<section>`). A scope indicator bar appears showing the scoped selector.

### Rescan

Button refreshes the element tree when the page changes (user opens modals, expands accordions, navigates SPAs). Also clears any active scope.

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
15. Rescan button refreshes the tree and clears scope.
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
