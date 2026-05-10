import { describe, it, expect } from 'vitest';
import { BLEND_MODES } from '@pef/shared';
import { blendPixel } from '../blend-cpu.js';

describe('blendPixel', () => {
  it('multiply of white and color is the color', () => {
    const r = blendPixel('multiply', [1, 1, 1, 1], [0.4, 0.5, 0.6, 1], 1);
    expect(r[0]).toBeCloseTo(0.4, 4);
    expect(r[1]).toBeCloseTo(0.5, 4);
    expect(r[2]).toBeCloseTo(0.6, 4);
  });

  it('screen of black and color is the color', () => {
    const r = blendPixel('screen', [0, 0, 0, 1], [0.3, 0.6, 0.9, 1], 1);
    expect(r[0]).toBeCloseTo(0.3, 4);
    expect(r[1]).toBeCloseTo(0.6, 4);
    expect(r[2]).toBeCloseTo(0.9, 4);
  });

  it('difference with self is black', () => {
    const r = blendPixel('difference', [0.4, 0.5, 0.6, 1], [0.4, 0.5, 0.6, 1], 1);
    expect(r[0]).toBeCloseTo(0, 4);
    expect(r[1]).toBeCloseTo(0, 4);
    expect(r[2]).toBeCloseTo(0, 4);
  });

  it('every blend mode returns finite RGBA in range', () => {
    for (const m of BLEND_MODES) {
      const r = blendPixel(m, [0.3, 0.5, 0.7, 1], [0.2, 0.4, 0.6, 1], 1);
      for (const v of r) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('opacity 0 returns base unchanged', () => {
    const r = blendPixel('multiply', [0.2, 0.4, 0.6, 1], [1, 1, 1, 1], 0);
    expect(r[0]).toBeCloseTo(0.2, 4);
    expect(r[1]).toBeCloseTo(0.4, 4);
    expect(r[2]).toBeCloseTo(0.6, 4);
  });
});
