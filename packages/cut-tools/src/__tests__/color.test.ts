import { describe, it, expect } from 'vitest';
import { rgbToLab, deltaE } from '../color.js';

describe('rgbToLab', () => {
  it('white maps to L≈100', () => {
    const lab = rgbToLab(255, 255, 255);
    expect(lab[0]).toBeCloseTo(100, 1);
  });

  it('black maps to L≈0', () => {
    const lab = rgbToLab(0, 0, 0);
    expect(lab[0]).toBeCloseTo(0, 1);
  });

  it('deltaE between identical colors is 0', () => {
    expect(deltaE(rgbToLab(120, 50, 200), rgbToLab(120, 50, 200))).toBe(0);
  });

  it('deltaE is positive for different colors', () => {
    expect(deltaE(rgbToLab(200, 0, 0), rgbToLab(0, 200, 0))).toBeGreaterThan(20);
  });
});
