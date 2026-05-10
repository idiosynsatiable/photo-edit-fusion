import type { Document, Layer, Vec2 } from '@pef/shared';
import { applyMatrix, invertMatrix, transformToMatrix } from './transform.js';
import { orderedLayers } from './document.js';

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function layerLocalSize(l: Layer): { w: number; h: number } {
  switch (l.type) {
    case 'image':
      return { w: l.sourceWidth, h: l.sourceHeight };
    case 'shape':
      return { w: l.width, h: l.height };
    case 'text':
      // approximate text bounds; precise bounds are computed at render time
      return { w: l.text.length * l.fontSizePx * 0.55, h: l.fontSizePx * l.lineHeight };
    case 'group':
      return { w: 0, h: 0 };
  }
}

export function layerWorldBounds(l: Layer): AABB {
  const { w, h } = layerLocalSize(l);
  if (w === 0 && h === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const m = transformToMatrix(l.transform, w, h);
  const corners: Vec2[] = [
    { x: 0, y: 0 },
    { x: w, y: 0 },
    { x: w, y: h },
    { x: 0, y: h },
  ];
  const ws = corners.map((c) => applyMatrix(m, c));
  const xs = ws.map((p) => p.x);
  const ys = ws.map((p) => p.y);
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

/** Returns the topmost layer containing point `p` in document space, or null. */
export function hitTest(doc: Document, p: Vec2): Layer | null {
  const layers = orderedLayers(doc);
  for (let i = layers.length - 1; i >= 0; i--) {
    const l = layers[i]!;
    if (!l.visible || l.locked) continue;
    const { w, h } = layerLocalSize(l);
    if (w === 0 && h === 0) continue;
    const m = transformToMatrix(l.transform, w, h);
    const inv = invertMatrix(m);
    const local = applyMatrix(inv, p);
    if (local.x >= 0 && local.x <= w && local.y >= 0 && local.y <= h) return l;
  }
  return null;
}
