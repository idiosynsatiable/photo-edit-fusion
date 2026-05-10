import type { BlendMode } from '@pef/shared';

/**
 * Pure-CPU reference implementation of every blend mode. Used by tests and as
 * the fallback when neither WebGL2 nor Canvas2D's globalCompositeOperation can
 * deliver the right result.
 *
 * Inputs are RGBA components in [0,1].
 */

export type RGB = [number, number, number];
export type RGBA = [number, number, number, number];

const lum = (c: RGB): number => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
const satC = (c: RGB): number => Math.max(...c) - Math.min(...c);
const clip01 = (x: number): number => Math.max(0, Math.min(1, x));

function clipColor(c: RGB): RGB {
  const l = lum(c);
  const n = Math.min(...c);
  const x = Math.max(...c);
  let out: RGB = [c[0], c[1], c[2]];
  if (n < 0) out = [l + ((c[0] - l) * l) / (l - n + 1e-12), l + ((c[1] - l) * l) / (l - n + 1e-12), l + ((c[2] - l) * l) / (l - n + 1e-12)];
  if (x > 1) out = [
    out[0] === undefined ? l : l + ((out[0] - l) * (1 - l)) / (x - l + 1e-12),
    out[1] === undefined ? l : l + ((out[1] - l) * (1 - l)) / (x - l + 1e-12),
    out[2] === undefined ? l : l + ((out[2] - l) * (1 - l)) / (x - l + 1e-12),
  ];
  return out;
}

function setLum(c: RGB, l: number): RGB {
  const d = l - lum(c);
  return clipColor([c[0] + d, c[1] + d, c[2] + d]);
}

function setSat(c: RGB, s: number): RGB {
  const arr: { v: number; i: number }[] = [c[0], c[1], c[2]].map((v, i) => ({ v, i }));
  arr.sort((a, b) => a.v - b.v);
  const mn = arr[0]!;
  const md = arr[1]!;
  const mx = arr[2]!;
  const out: RGB = [0, 0, 0];
  if (mx.v > mn.v) {
    out[md.i as 0 | 1 | 2] = ((md.v - mn.v) * s) / (mx.v - mn.v);
    out[mx.i as 0 | 1 | 2] = s;
  }
  return out;
}

export function blendPixel(mode: BlendMode, b: RGBA, s: RGBA, opacity: number): RGBA {
  const sa = s[3] * opacity;
  const blended = blendRGB(mode, [b[0], b[1], b[2]], [s[0], s[1], s[2]]);
  return [
    b[0] * (1 - sa) + blended[0] * sa,
    b[1] * (1 - sa) + blended[1] * sa,
    b[2] * (1 - sa) + blended[2] * sa,
    Math.max(b[3], sa),
  ];
}

function blendRGB(mode: BlendMode, b: RGB, s: RGB): RGB {
  switch (mode) {
    case 'normal':
    case 'dissolve':
      return s;
    case 'darken':
      return [Math.min(b[0], s[0]), Math.min(b[1], s[1]), Math.min(b[2], s[2])];
    case 'multiply':
      return [b[0] * s[0], b[1] * s[1], b[2] * s[2]];
    case 'color-burn':
      return [
        s[0] === 0 ? 0 : 1 - Math.min(1, (1 - b[0]) / s[0]),
        s[1] === 0 ? 0 : 1 - Math.min(1, (1 - b[1]) / s[1]),
        s[2] === 0 ? 0 : 1 - Math.min(1, (1 - b[2]) / s[2]),
      ];
    case 'linear-burn':
      return [Math.max(b[0] + s[0] - 1, 0), Math.max(b[1] + s[1] - 1, 0), Math.max(b[2] + s[2] - 1, 0)];
    case 'darker-color':
      return lum(s) < lum(b) ? s : b;
    case 'lighten':
      return [Math.max(b[0], s[0]), Math.max(b[1], s[1]), Math.max(b[2], s[2])];
    case 'screen':
      return [1 - (1 - b[0]) * (1 - s[0]), 1 - (1 - b[1]) * (1 - s[1]), 1 - (1 - b[2]) * (1 - s[2])];
    case 'color-dodge':
      return [
        s[0] === 1 ? 1 : Math.min(1, b[0] / (1 - s[0])),
        s[1] === 1 ? 1 : Math.min(1, b[1] / (1 - s[1])),
        s[2] === 1 ? 1 : Math.min(1, b[2] / (1 - s[2])),
      ];
    case 'linear-dodge':
      return [Math.min(b[0] + s[0], 1), Math.min(b[1] + s[1], 1), Math.min(b[2] + s[2], 1)];
    case 'lighter-color':
      return lum(s) > lum(b) ? s : b;
    case 'overlay':
      return overlayChannel(b, s);
    case 'soft-light':
      return softLightChannel(b, s);
    case 'hard-light':
      return overlayChannel(s, b);
    case 'vivid-light':
      return [vivid(b[0], s[0]), vivid(b[1], s[1]), vivid(b[2], s[2])];
    case 'linear-light':
      return [clip01(b[0] + 2 * s[0] - 1), clip01(b[1] + 2 * s[1] - 1), clip01(b[2] + 2 * s[2] - 1)];
    case 'pin-light':
      return [pin(b[0], s[0]), pin(b[1], s[1]), pin(b[2], s[2])];
    case 'hard-mix':
      return [b[0] + s[0] >= 1 ? 1 : 0, b[1] + s[1] >= 1 ? 1 : 0, b[2] + s[2] >= 1 ? 1 : 0];
    case 'difference':
      return [Math.abs(b[0] - s[0]), Math.abs(b[1] - s[1]), Math.abs(b[2] - s[2])];
    case 'exclusion':
      return [b[0] + s[0] - 2 * b[0] * s[0], b[1] + s[1] - 2 * b[1] * s[1], b[2] + s[2] - 2 * b[2] * s[2]];
    case 'subtract':
      return [Math.max(b[0] - s[0], 0), Math.max(b[1] - s[1], 0), Math.max(b[2] - s[2], 0)];
    case 'divide':
      return [Math.min(b[0] / Math.max(s[0], 1e-5), 1), Math.min(b[1] / Math.max(s[1], 1e-5), 1), Math.min(b[2] / Math.max(s[2], 1e-5), 1)];
    case 'hue':
      return setLum(setSat(s, satC(b)), lum(b));
    case 'saturation':
      return setLum(setSat(b, satC(s)), lum(b));
    case 'color':
      return setLum(s, lum(b));
    case 'luminosity':
      return setLum(b, lum(s));
  }
}

function overlayChannel(b: RGB, s: RGB): RGB {
  return [overlayC(b[0], s[0]), overlayC(b[1], s[1]), overlayC(b[2], s[2])];
}

function overlayC(b: number, s: number): number {
  return b < 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s);
}

function softLightChannel(b: RGB, s: RGB): RGB {
  return [softLightC(b[0], s[0]), softLightC(b[1], s[1]), softLightC(b[2], s[2])];
}

function softLightC(b: number, s: number): number {
  if (s < 0.5) return b - (1 - 2 * s) * b * (1 - b);
  const d = b < 0.25 ? ((16 * b - 12) * b + 4) * b : Math.sqrt(b);
  return b + (2 * s - 1) * (d - b);
}

function vivid(b: number, s: number): number {
  if (s < 0.5) return s === 0 ? 0 : 1 - Math.min(1, (1 - b) / (2 * s));
  const k = 2 * (s - 0.5);
  return k === 1 ? 1 : Math.min(1, b / (1 - k));
}

function pin(b: number, s: number): number {
  return s < 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1);
}
