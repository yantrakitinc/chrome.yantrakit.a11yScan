# F08 — CVD (Color Vision Deficiency) simulation

## Purpose
Apply a SVG color-matrix filter to the inspected page to simulate 8 color-vision-deficiency types: protanopia, deuteranopia, protanomaly, deuteranomaly, tritanopia, tritanomaly, achromatopsia, achromatomaly.

## Source of truth
[F08-cvd-simulation.md](../../legacy/features/F08-cvd-simulation.md)

## Acceptance criteria

- [ ] CVD dropdown lists all 8 simulation types + "Normal vision"
- [ ] Selecting a type sends APPLY_CVD_FILTER with the correct color matrix
- [ ] Content script injects SVG filter into the page DOM and applies it via CSS filter
- [ ] Selecting "Normal vision" sends APPLY_CVD_FILTER with matrix=null and removes the filter
- [ ] Filter persists across page navigation within the tab
- [ ] Filter does NOT leak into the side panel itself (panel stays color-correct)
- [ ] Sidepanel state.cvdFilter persists across re-renders (selected option remains highlighted)

## Verification mechanism
`e2e/verify-feature-f08-cvd-simulation.ts` — fixture page with red/green text; apply protanopia filter; verify computed style on filter element + visual screenshot diff vs unfiltered baseline.

## Structural gaps
- Pixel-level color accuracy of the simulation is NOT verified — only that a filter is applied with the correct matrix values. Color science correctness trusts the published matrices.
