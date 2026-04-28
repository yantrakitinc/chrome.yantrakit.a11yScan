// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { CVD_MATRICES } from "../sidepanel";

describe("CVD_MATRICES — color-vision-deficiency simulation matrices (F08)", () => {
  it("includes the 8 documented CVD presets", () => {
    expect(Object.keys(CVD_MATRICES).sort()).toEqual([
      "achromatomaly",
      "achromatopsia",
      "deuteranomaly",
      "deuteranopia",
      "protanomaly",
      "protanopia",
      "tritanomaly",
      "tritanopia",
    ]);
  });

  it("every matrix is a 9-element array (3×3 RGB transform)", () => {
    for (const [name, matrix] of Object.entries(CVD_MATRICES)) {
      expect(matrix.length, `matrix ${name} length`).toBe(9);
    }
  });

  it("every entry is a finite number", () => {
    for (const [name, matrix] of Object.entries(CVD_MATRICES)) {
      for (const v of matrix) {
        expect(Number.isFinite(v), `matrix ${name} has finite entries`).toBe(true);
      }
    }
  });

  it("achromatopsia rows are identical (gray-scale: each output channel uses the same recipe)", () => {
    const m = CVD_MATRICES.achromatopsia;
    expect(m.slice(0, 3)).toEqual(m.slice(3, 6));
    expect(m.slice(3, 6)).toEqual(m.slice(6, 9));
  });

  it("each row's RGB coefficients sum to 1 (or very close — luminance-preserving)", () => {
    for (const [name, matrix] of Object.entries(CVD_MATRICES)) {
      for (let r = 0; r < 3; r++) {
        const row = matrix.slice(r * 3, r * 3 + 3);
        const sum = row.reduce((a, b) => a + b, 0);
        expect(sum, `${name} row ${r} sum=${sum}`).toBeCloseTo(1, 1);
      }
    }
  });
});
