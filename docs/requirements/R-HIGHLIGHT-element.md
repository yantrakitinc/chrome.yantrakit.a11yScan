# R-HIGHLIGHT — Element Highlighting

## Purpose

Visually highlight a specific element on the page when the user clicks a row in the side panel (SR row, KB row, violation node, observer entry, etc.).

## Behavior

1. Sidepanel sends `HIGHLIGHT_ELEMENT { selector }`.
2. Content script:
   - `document.querySelector(selector)` to find the element
   - If not found: return `{ found: false }`
   - If found:
     - `element.scrollIntoView({ block: "center", behavior: "smooth" })`
     - Apply a 3-second amber glow animation:
       - Outline: `4px solid var(--ds-amber-500)` with offset
       - Box-shadow: `0 0 12px 4px rgba(245, 158, 11, 0.6)`
       - Transition fade-out over 3 seconds
     - Return `{ found: true }`

The glow is applied via a temporary class on the element, and a stylesheet injected into the document. After 3 seconds, the class is removed.

If `HIGHLIGHT_ELEMENT` is sent again before the 3 seconds expire, the glow on the previous element is cleared and applied to the new element.

`CLEAR_HIGHLIGHTS` removes any active glow.

## Side panel feedback

When `{ found: false }` is received, the side panel shows a toast: "Element not found on page". The toast has `role="alert" aria-live="assertive"` and disappears after 3 seconds.

## Side panel row highlighting

Independently, the side panel row that triggered the highlight gets a 3-second `.ds-row--active` class for visual continuity. (See R-SR for SR rows.)

## Test cases

### E2E

1. Click a violation row's selector → page element gets amber glow for 3s, scrolled into center.
2. Click a SR row → same behavior.
3. Click a row whose selector doesn't exist (e.g., page changed) → toast "Element not found on page".
4. Click two rows in quick succession → only the most recent element is glowing.
