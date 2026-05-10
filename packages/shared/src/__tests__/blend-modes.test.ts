import { describe, it, expect } from 'vitest';
import { BLEND_MODES, isBlendMode, CANVAS2D_FALLBACK, WEBGL_REQUIRED } from '../blend-modes.js';

describe('blend-modes', () => {
  it('exposes 27 modes', () => {
    expect(BLEND_MODES.length).toBe(27);
  });

  it('isBlendMode rejects garbage', () => {
    expect(isBlendMode('multiply')).toBe(true);
    expect(isBlendMode('garbage')).toBe(false);
    expect(isBlendMode(null)).toBe(false);
  });

  it('every blend mode has a Canvas2D fallback', () => {
    for (const m of BLEND_MODES) {
      expect(CANVAS2D_FALLBACK[m]).toBeTruthy();
    }
  });

  it('webgl-required is a strict subset', () => {
    for (const m of WEBGL_REQUIRED) {
      expect(BLEND_MODES.includes(m)).toBe(true);
    }
  });
});
