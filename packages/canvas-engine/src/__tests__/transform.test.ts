import { describe, it, expect } from 'vitest';
import { applyMatrix, identityTransform, invertMatrix, transformToMatrix } from '../transform.js';

describe('transform', () => {
  it('places the local center at the position anchor', () => {
    const m = transformToMatrix(identityTransform(), 100, 100);
    const p = applyMatrix(m, { x: 50, y: 50 });
    // The renderer places the center at position (0, 0).
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.y).toBeCloseTo(0, 5);
  });

  it('translate moves point', () => {
    const t = identityTransform();
    t.position = { x: 10, y: 20 };
    const m = transformToMatrix(t, 100, 100);
    const p = applyMatrix(m, { x: 50, y: 50 });
    expect(p.x).toBeCloseTo(10, 5);
    expect(p.y).toBeCloseTo(20, 5);
  });

  it('inverse undoes forward', () => {
    const t = identityTransform();
    t.position = { x: 10, y: 20 };
    t.rotation = 0.5;
    t.scale = { x: 1.5, y: 1.5 };
    const m = transformToMatrix(t, 100, 100);
    const inv = invertMatrix(m);
    const p = { x: 33, y: 77 };
    const round = applyMatrix(inv, applyMatrix(m, p));
    expect(round.x).toBeCloseTo(p.x, 4);
    expect(round.y).toBeCloseTo(p.y, 4);
  });
});
