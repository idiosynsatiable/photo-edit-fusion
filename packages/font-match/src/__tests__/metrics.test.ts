import { describe, it, expect } from 'vitest';
import { binarizeOtsu, extractFeatures, densityToWeight } from '../metrics.js';

function makeImage(w: number, h: number, fillBlack: boolean): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < arr.length; i += 4) {
    arr[i] = fillBlack ? 0 : 255;
    arr[i + 1] = fillBlack ? 0 : 255;
    arr[i + 2] = fillBlack ? 0 : 255;
    arr[i + 3] = 255;
  }
  return arr;
}

describe('binarizeOtsu', () => {
  it('handles all-white image', () => {
    const data = makeImage(4, 4, false);
    const bin = binarizeOtsu({ width: 4, height: 4, data });
    // every pixel is at or above threshold so foreground count is 0
    expect(bin.every((v) => v === 0)).toBe(true);
  });

  it('marks black pixels as foreground', () => {
    const w = 4;
    const h = 4;
    const data = makeImage(w, h, false);
    // mark center 2x2 as black
    for (let y = 1; y <= 2; y++)
      for (let x = 1; x <= 2; x++) {
        const i = (y * w + x) * 4;
        data[i] = 0;
        data[i + 1] = 0;
        data[i + 2] = 0;
      }
    const bin = binarizeOtsu({ width: w, height: h, data });
    expect(bin[1 * w + 1]).toBe(1);
    expect(bin[0]).toBe(0);
  });
});

describe('extractFeatures', () => {
  it('returns zero features for empty boxes', () => {
    const f = extractFeatures(new Uint8Array(16), 4, 4, []);
    expect(f.glyphCount).toBe(0);
    expect(f.strokeDensity).toBe(0);
  });
});

describe('densityToWeight', () => {
  it('maps low density to thin weights', () => {
    expect(densityToWeight(0.05)).toBeLessThanOrEqual(200);
  });
  it('maps high density to bold weights', () => {
    expect(densityToWeight(0.25)).toBeGreaterThanOrEqual(700);
  });
  it('always returns a multiple of 100 in [100,900]', () => {
    for (let d = 0; d <= 0.4; d += 0.02) {
      const w = densityToWeight(d);
      expect(w).toBeGreaterThanOrEqual(100);
      expect(w).toBeLessThanOrEqual(900);
      expect(w % 100).toBe(0);
    }
  });
});
