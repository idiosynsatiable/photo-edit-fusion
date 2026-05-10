import { describe, it, expect } from 'vitest';
import { applyMatrix, identityTransform, invertMatrix, transformToMatrix } from '../transform.js';

describe('transform', () => {
  it('identity is identity', () => {
    const m = transformToMatrix(identityTransform(), 100, 100);
    const p = applyMatrix(m, { x: 50, y: 50 });
    // anchor 0.5,0.5 + position 0,0 — point at center stays at center
    expect(p.x).toBeCloseTo(50, 5);
    expect(p.y).toBeCloseTo(50, 5);
  });

  it('translate moves point', () => {
    const t = identityTransform();
    t.position = { x: 10, y: 20 };
    const m = transformToMatrix(t, 100, 100);
    const p = applyMatrix(m, { x: 50, y: 50 });
    expect(p.x).toBeCloseTo(60, 5);
    expect(p.y).toBeCloseTo(70, 5);
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
