import type { Document, Layer, Vec2 } from '@pef/shared';
import { applyMatrix, invertMatrix, transformToMatrix } from './transform.js';
import { orderedLayers } from './document.js';

interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function layerLocalSize(l: Layer): { w: number; h: number } {
  switch (l.type) {
    case 'image':
      return { w: l.sourceWidth, h: l.sourceHeight };
    case 'shape':
      return { w: l.width, h: l.height };
    case 'text':
      if (l.inkMetrics) return { w: l.inkMetrics.width * l.fontSizePx, h: l.inkMetrics.height * l.fontSizePx };
      // approximate text bounds; precise bounds are computed at render time
      return { w: Math.max(1, ...l.text.split('\n').map((line) => line.length)) * l.fontSizePx * 0.55, h: l.text.split('\n').length * l.fontSizePx * l.lineHeight };
    case 'group':
      return { w: 0, h: 0 };
  }
}

export function layerWorldBounds(l: Layer): AABB {
  const { w, h } = layerLocalSize(l);
  if (w === 0 && h === 0) return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const m = transformToMatrix(l.transform, w, h);
  const outline = l.type === 'text' ? l.outline?.width ?? 0 : l.type === 'shape' ? l.strokeWidth / 2 : 0;
  const shadow = l.type === 'text' ? l.shadow : undefined;
  const left = Math.min(-outline, shadow ? shadow.x - shadow.blur * 3 : 0), top = Math.min(-outline, shadow ? shadow.y - shadow.blur * 3 : 0);
  const right = Math.max(outline, shadow ? shadow.x + shadow.blur * 3 : 0), bottom = Math.max(outline, shadow ? shadow.y + shadow.blur * 3 : 0);
  const corners: Vec2[] = [{x:left,y:top},{x:w+right,y:top},{x:w+right,y:h+bottom},{x:left,y:h+bottom}];
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
