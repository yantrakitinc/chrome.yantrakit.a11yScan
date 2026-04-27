# R-ARIA — ARIA Pattern Validation

## Purpose

Detect ARIA widget patterns on the page (tablist, menu, dialog, combobox, accordion, listbox, tree, slider, spinbutton, tabpanel, etc.) and validate each against the WAI-ARIA Authoring Practices.

## Activation

Lives in the **ARIA** sub-tab of the Scan tab. Visible after a scan completes.

## Detection (content script)

Walk DOM looking for elements with `role="tablist"`, `role="menu"`, `role="dialog"`, `role="combobox"`, etc. For each, check the required attributes per the WAI-ARIA spec.

Example: `role="tablist"` requires:
- Has children with `role="tab"`
- At least one `tab` has `aria-selected="true"`
- Each `tab` has `aria-controls` pointing to a valid element
- Tab and tabpanel relationship is bidirectional via `aria-labelledby`

If all conditions pass, widget is "valid". Otherwise list specific failures.

Returns `iAriaWidget[]` with `{ role, label, selector, valid: boolean, issues: string[] }`.

## UI

Two groups: failures first, passes second.

```
ARIA Issues (5)
[▼] tablist  Site sections                 ✗
    Missing aria-selected on at least one tab
    Tab[2] aria-controls points to non-existent element
    [Highlight on page]

[▼] dialog  Confirmation                   ✗
    Missing aria-modal
    [Highlight on page]
…

ARIA Passing (3)
[▼] tablist  Help sections                 ✓
[▼] accordion  FAQs                        ✓
…
```

Each widget is a `<details class="ds-disclosure">`. Issues listed in red. Passing widgets are collapsed by default; failing are open by default.

Each widget summary has a "Highlight on page" affordance (small button) that sends `HIGHLIGHT_ELEMENT` for the widget's selector.

## Test config consumption

Not consumed.

## Test cases

### E2E

1. Run scan on the ARIA demo page → ARIA sub-tab shows 5 broken widgets and 3 valid widgets.
2. Click a broken widget → expands, lists specific issues.
3. Click "Highlight on page" → page element gets 3s glow.
