# R-CVD — Color Vision Deficiency Simulation

## Purpose

Simulate how the page appears for users with various forms of color vision deficiency. Helps developers find designs that rely on color alone.

## UI

A `<select>` in the panel header, right side:

```html
<select id="cvd-select" aria-label="Color vision simulation">
  <option value="">Normal vision</option>
  <option value="protanopia">Protanopia</option>
  <option value="deuteranopia">Deuteranopia</option>
  <option value="tritanopia">Tritanopia</option>
  <option value="protanomaly">Protanomaly</option>
  <option value="deuteranomaly">Deuteranomaly</option>
  <option value="tritanomaly">Tritanomaly</option>
  <option value="achromatopsia">Achromatopsia</option>
  <option value="achromatomaly">Achromatomaly</option>
</select>
```

9 options total: 1 normal + 8 simulations.

## Implementation

When user changes the select: `state.cvdType = value`. Send `APPLY_CVD { type: value }` to content script.

Content script applies an SVG color matrix filter to `document.documentElement.style.filter`:

- Normal: `filter: ""`
- Other types: `filter: url(#a11y-scan-cvd-{type})` where the SVG `<filter>` is injected into the document with the appropriate matrix.

SVG color matrices (4×5) for each CVD type are defined in `src/content/cvd-matrices.ts`. These are standard published values (Brettel/Vienot models).

## Persistence

`state.cvdType` is NOT persisted. Reset to "" on each panel open.

## Test config consumption

Not consumed.

## Test cases

### E2E

1. Open side panel → CVD select shows "Normal vision".
2. Select "Deuteranopia" → page appears with deuteranopia simulation (red-green confusion).
3. Select "Achromatopsia" → page appears in grayscale.
4. Select "Normal vision" → simulation removed.
5. Reload page → simulation removed.
