# F08 — Color Blindness Simulation

## Purpose

Apply real-time color vision deficiency (CVD) filters to the current page so users can see how the page appears to people with different types of color blindness.

## Dependencies

- None (independent feature, always available)

## Behavior

### Activation

Dropdown in the panel header. Always accessible regardless of phase or tab. Options:

1. **Normal vision** (default — no filter applied)
2. **Protanopia** (no red cones — red-blind)
3. **Deuteranopia** (no green cones — green-blind)
4. **Tritanopia** (no blue cones — blue-blind)
5. **Protanomaly** (weak red cones)
6. **Deuteranomaly** (weak green cones)
7. **Tritanomaly** (weak blue cones)
8. **Achromatopsia** (total color blindness — grayscale)
9. **Achromatomaly** (partial color blindness — near grayscale)

### Implementation

Each simulation uses an SVG `<feColorMatrix>` filter applied to the page's `<html>` element via CSS `filter: url(#cvd-filter)`.

The SVG filter definition is injected into the page with a unique ID. The color matrix values for each type are well-established constants from color science research.

When user selects a simulation:
1. Side panel sends `APPLY_CVD_FILTER` message with the matrix type.
2. Content script injects/updates the SVG filter definition.
3. Content script applies `filter: url(#a11y-scan-cvd-filter)` to `<html>`.
4. Selecting "Normal vision" removes the filter.

### Color matrices

Standard 5×4 color transformation matrices. Each matrix is a 20-value array representing the transformation:

```
| R' |   | m[0]  m[1]  m[2]  m[3]  m[4]  |   | R |
| G' | = | m[5]  m[6]  m[7]  m[8]  m[9]  | × | G |
| B' |   | m[10] m[11] m[12] m[13] m[14] |   | B |
| A' |   | m[15] m[16] m[17] m[18] m[19] |   | A |
                                               | 1 |
```

```typescript
// Source: extension/src/sidepanel/sidepanel.ts (CVD_MATRICES constant)
// Format: 9-element array representing a 3x3 color matrix.
// Applied as feColorMatrix values: `${m0} ${m1} ${m2} 0 0 ${m3} ${m4} ${m5} 0 0 ${m6} ${m7} ${m8} 0 0 0 0 0 1 0`
const CVD_MATRICES: Record<string, number[]> = {
  protanopia:     [0.567, 0.433, 0,     0.558, 0.442, 0,     0,     0.242, 0.758],
  deuteranopia:   [0.625, 0.375, 0,     0.7,   0.3,   0,     0,     0.3,   0.7  ],
  protanomaly:    [0.817, 0.183, 0,     0.333, 0.667, 0,     0,     0.125, 0.875],
  deuteranomaly:  [0.8,   0.2,   0,     0.258, 0.742, 0,     0,     0.142, 0.858],
  tritanopia:     [0.95,  0.05,  0,     0,     0.433, 0.567, 0,     0.475, 0.525],
  tritanomaly:    [0.967, 0.033, 0,     0,     0.733, 0.267, 0,     0.183, 0.817],
  achromatopsia:  [0.299, 0.587, 0.114, 0.299, 0.587, 0.114, 0.299, 0.587, 0.114],
  achromatomaly:  [0.618, 0.32,  0.062, 0.163, 0.775, 0.062, 0.163, 0.32,  0.516],
};
```

### Performance

- Filter is GPU-accelerated via CSS.
- No DOM mutation other than the SVG filter element and one CSS property.
- Zero impact on scan results (filter is visual only).

## Acceptance Criteria

1. CVD dropdown is in the header, always accessible.
2. Selecting a simulation type applies the color filter to the page.
3. Selecting "Normal vision" removes the filter.
4. All 8 simulation types render distinct color transformations.
5. Filter persists across page scrolling.
6. Filter is removed when navigating to a new page (content script re-injection handles this).
7. Filter does not affect scan results.
8. Dropdown fits within header space at 360px panel width.
