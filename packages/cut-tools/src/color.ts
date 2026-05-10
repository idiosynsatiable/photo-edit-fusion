/**
 * sRGB ↔ CIE LAB conversion. Used by the magic-wand tool for perceptually
 * uniform color similarity instead of naive RGB Euclidean distance.
 */

function srgbToLinear(c: number): number {
  const x = c / 255;
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

function linearToXyz(r: number, g: number, b: number): [number, number, number] {
  const x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
  const y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b;
  const z = 0.0193339 * r + 0.119192 * g + 0.9503041 * b;
  return [x, y, z];
}

const Xn = 0.95047;
const Yn = 1.0;
const Zn = 1.08883;

function f(t: number): number {
  return t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
}

export function rgbToLab(r: number, g: number, b: number): [number, number, number] {
  const [x, y, z] = linearToXyz(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const fx = f(x / Xn);
  const fy = f(y / Yn);
  const fz = f(z / Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

export function deltaE(a: [number, number, number], b: [number, number, number]): number {
  // CIE76 — fast, sufficient for selection tools
  const dl = a[0] - b[0];
  const da = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dl * dl + da * da + db * db);
}
