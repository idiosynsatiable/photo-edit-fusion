import { rgbToLab, deltaE } from './color.js';
import { createMask, type Mask } from './mask.js';

export interface MagicWandOptions {
  width: number;
  height: number;
  /** RGBA pixel array, length = width * height * 4 */
  pixels: Uint8ClampedArray;
  /** seed pixel coordinates */
  seed: { x: number; y: number };
  /** LAB ΔE threshold; typical 5..30, higher = more pixels selected */
  tolerance: number;
  /** if true, only flood-fill connected pixels; if false, sample globally */
  contiguous: boolean;
}

/**
 * Magic-wand selection. Compares every candidate pixel to the seed in CIE LAB
 * space using ΔE76 and selects those within `tolerance`. Returns a hard 0/255
 * mask; feather it with featherMask() if soft edges are required.
 */
export function magicWand(opts: MagicWandOptions): Mask {
  const { width, height, pixels, seed, tolerance, contiguous } = opts;
  const mask = createMask(width, height);
  if (seed.x < 0 || seed.x >= width || seed.y < 0 || seed.y >= height) return mask;

  const seedIdx = (seed.y * width + seed.x) * 4;
  const seedLab = rgbToLab(
    pixels[seedIdx] ?? 0,
    pixels[seedIdx + 1] ?? 0,
    pixels[seedIdx + 2] ?? 0,
  );

  if (!contiguous) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const lab = rgbToLab(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0);
        if (deltaE(seedLab, lab) <= tolerance) mask.data[y * width + x] = 255;
      }
    }
    return mask;
  }

  // contiguous flood-fill — iterative scanline for performance
  const stack: number[] = [seed.x, seed.y];
  const visited = new Uint8Array(width * height);
  while (stack.length > 0) {
    const py = stack.pop()!;
    const px = stack.pop()!;
    if (px < 0 || px >= width || py < 0 || py >= height) continue;
    const idx = py * width + px;
    if (visited[idx]) continue;
    visited[idx] = 1;
    const i = idx * 4;
    const lab = rgbToLab(pixels[i] ?? 0, pixels[i + 1] ?? 0, pixels[i + 2] ?? 0);
    if (deltaE(seedLab, lab) > tolerance) continue;
    mask.data[idx] = 255;
    stack.push(px + 1, py);
    stack.push(px - 1, py);
    stack.push(px, py + 1);
    stack.push(px, py - 1);
  }
  return mask;
}
