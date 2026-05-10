import type { Vec2 } from '@pef/shared';
import { createMask, type Mask } from './mask.js';

/**
 * Rasterize a closed polygon into a Mask using the even-odd fill rule.
 * Suitable for the lasso, polygon, and rectangle selection tools.
 */
export function rasterizePolygon(
  width: number,
  height: number,
  points: Vec2[],
): Mask {
  const mask = createMask(width, height);
  if (points.length < 3) return mask;
  for (let y = 0; y < height; y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i]!;
      const p2 = points[(i + 1) % points.length]!;
      if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
        const t = (y - p1.y) / (p2.y - p1.y);
        xs.push(p1.x + t * (p2.x - p1.x));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length - 1; i += 2) {
      const x0 = Math.max(0, Math.ceil(xs[i]!));
      const x1 = Math.min(width - 1, Math.floor(xs[i + 1]!));
      for (let x = x0; x <= x1; x++) mask.data[y * width + x] = 255;
    }
  }
  return mask;
}

/**
 * Build a lasso point sequence from a stream of mouse positions, applying
 * Douglas-Peucker simplification to remove redundant points.
 */
export function simplifyPath(points: Vec2[], tolerancePx = 1): Vec2[] {
  if (points.length < 3) return points.slice();
  return rdp(points, tolerancePx);
}

function rdp(points: Vec2[], epsilon: number): Vec2[] {
  if (points.length < 3) return points.slice();
  const first = points[0]!;
  const last = points[points.length - 1]!;
  let maxDist = 0;
  let idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicularDistance(points[i]!, first, last);
    if (d > maxDist) {
      maxDist = d;
      idx = i;
    }
  }
  if (maxDist <= epsilon) return [first, last];
  return [...rdp(points.slice(0, idx + 1), epsilon).slice(0, -1), ...rdp(points.slice(idx), epsilon)];
}

function perpendicularDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const cx = a.x + t * dx;
  const cy = a.y + t * dy;
  return Math.hypot(p.x - cx, p.y - cy);
}
