import { describe, it, expect } from 'vitest';
import { magicWand } from '../magic-wand.js';

function makePixels(w: number, h: number, fill: [number, number, number, number]): Uint8ClampedArray {
  const arr = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < arr.length; i += 4) {
    arr[i] = fill[0];
    arr[i + 1] = fill[1];
    arr[i + 2] = fill[2];
    arr[i + 3] = fill[3];
  }
  return arr;
}

describe('magicWand', () => {
  it('selects a uniform region with low tolerance', () => {
    const pixels = makePixels(8, 8, [200, 50, 50, 255]);
    const m = magicWand({
      width: 8,
      height: 8,
      pixels,
      seed: { x: 4, y: 4 },
      tolerance: 5,
      contiguous: true,
    });
    expect(m.data.every((v) => v === 255)).toBe(true);
  });

  it('does not select dissimilar pixels', () => {
    const w = 8;
    const h = 8;
    const arr = makePixels(w, h, [200, 50, 50, 255]);
    // splash 4x4 region of green pixels
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const i = (y * w + x) * 4;
        arr[i] = 50;
        arr[i + 1] = 200;
        arr[i + 2] = 50;
        arr[i + 3] = 255;
      }
    }
    const m = magicWand({ width: w, height: h, pixels: arr, seed: { x: 7, y: 7 }, tolerance: 8, contiguous: true });
    expect(m.data[7 * w + 7]).toBe(255);
    expect(m.data[0]).toBe(0);
  });

  it('seed outside bounds returns empty mask', () => {
    const pixels = makePixels(4, 4, [0, 0, 0, 255]);
    const m = magicWand({
      width: 4,
      height: 4,
      pixels,
      seed: { x: -1, y: 0 },
      tolerance: 5,
      contiguous: true,
    });
    expect(m.data.every((v) => v === 0)).toBe(true);
  });
});
