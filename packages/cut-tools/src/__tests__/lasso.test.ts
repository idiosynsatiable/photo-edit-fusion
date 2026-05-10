import { describe, it, expect } from 'vitest';
import { rasterizePolygon, simplifyPath } from '../lasso.js';

describe('rasterizePolygon', () => {
  it('fills a square polygon', () => {
    const m = rasterizePolygon(10, 10, [
      { x: 2, y: 2 },
      { x: 8, y: 2 },
      { x: 8, y: 8 },
      { x: 2, y: 8 },
    ]);
    expect(m.data[2 * 10 + 5]).toBe(255);
    expect(m.data[5 * 10 + 5]).toBe(255);
    expect(m.data[0]).toBe(0);
  });

  it('returns empty mask for too few points', () => {
    const m = rasterizePolygon(5, 5, [{ x: 0, y: 0 }, { x: 4, y: 4 }]);
    expect(m.data.every((v) => v === 0)).toBe(true);
  });
});

describe('simplifyPath', () => {
  it('keeps endpoints', () => {
    const p = simplifyPath(
      [
        { x: 0, y: 0 },
        { x: 1, y: 0.1 },
        { x: 2, y: 0.2 },
        { x: 10, y: 0 },
      ],
      1,
    );
    expect(p.length).toBeLessThanOrEqual(4);
    expect(p[0]).toEqual({ x: 0, y: 0 });
    expect(p[p.length - 1]).toEqual({ x: 10, y: 0 });
  });
});
