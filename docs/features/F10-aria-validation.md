# F10 — ARIA Pattern Validation

## Purpose

Detect ARIA widgets on the page and validate each against the WAI-ARIA Authoring Practices specification. Goes beyond axe-core's ARIA checks by validating structural patterns, required children, and attribute relationships.

## Dependencies

- F01 (Single Page Scan) — triggers alongside or after scan

## Behavior

### Sub-tab location

ARIA validation results appear in the **ARIA** sub-tab of the Scan tab.

### Supported widgets (12)

| Widget | Detection | Key validations |
|---|---|---|
| tablist | `role="tablist"` | Has tab children, tabs have aria-selected, tabs have aria-controls pointing to tabpanels |
| menu | `role="menu"` | Has menuitem children, has aria-orientation |
| menubar | `role="menubar"` | Has menuitem children, horizontal orientation |
| dialog | `role="dialog"` or `<dialog>` | Has aria-modal, has focusable child, has aria-label/labelledby |
| alertdialog | `role="alertdialog"` | Same as dialog + aria-describedby |
| combobox | `role="combobox"` | Has aria-controls pointing to listbox, has aria-expanded |
| slider | `role="slider"` | Has aria-valuenow, aria-valuemin, aria-valuemax |
| tree | `role="tree"` | Has treeitem children, treeitems have aria-expanded |
| radiogroup | `role="radiogroup"` | Has radio children, one has aria-checked="true" |
| checkbox | `role="checkbox"` | Has aria-checked, has accessible name |
| switch | `role="switch"` | Has aria-checked, has accessible name |
| accordion | Heuristic: multiple buttons with aria-expanded in same parent | Each button has aria-expanded, controls a collapsible region |

### Future widgets (not yet supported)

listbox, grid, treegrid, toolbar, tooltip, feed, breadcrumb, progressbar, spinbutton, live regions (alert, status, log)

### Results display

**Header**: "**X widgets detected**" + "**Y issues · Z compliant**"

Two sections:
1. **Issues** — widgets with validation failures, sorted by severity.
2. **Compliant** — widgets that pass all checks.

Each widget is a `<details>` element:
- **Summary**: role badge + accessible name (label) + pass/fail indicator
  - Pass: green badge, "✓"
  - Fail: red badge, "N issues"
- **Expanded**:
  - List of specific missing/incorrect attributes (each as a left-bordered text line)
  - "**Highlight on page**" button (uses F07 element highlighting)

### Scan process

1. Content script scans the DOM for elements matching widget selectors.
2. For each detected widget, runs the validation checks defined in `aria-patterns.ts`.
3. Each check returns `{ pass: boolean, message: string }`.
4. Results aggregated per widget: total checks, passed, failed.
5. Sent to side panel for rendering.

### Data structures

```typescript
interface iAriaWidget {
  role: string;
  selector: string;
  label: string;           // computed accessible name
  html: string;            // outerHTML snippet
  checks: iAriaCheck[];
  passCount: number;
  failCount: number;
}

interface iAriaCheck {
  name: string;            // e.g., "has-aria-modal"
  pass: boolean;
  message: string;         // human-readable, e.g., "Missing aria-modal attribute"
}
```

## Acceptance Criteria

1. ARIA sub-tab shows when phase is Results, Paused, or Wait.
2. All 12 supported widget types are detected.
3. Each widget is validated against its required attributes/children.
4. Results are split into Issues and Compliant sections.
5. Each widget is expandable to show specific check details.
6. Failed checks show clear, actionable messages.
7. "Highlight on page" button works for each widget.
8. Role badges have consistent width (min-width) for alignment.
9. Widget results are included in exports.
10. Heuristic detection (accordion) correctly identifies non-role-based patterns.
