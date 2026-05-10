import { CANVAS2D_FALLBACK } from '@pef/shared';
import type { Document, Layer, ImageLayer, ShapeLayer, TextLayer } from '@pef/shared';

/**
 * Canvas2D-based renderer. Walks the layer order and draws each layer onto
 * the destination context, applying transform, blend mode, and opacity. The
 * native globalCompositeOperation path covers 16 of the 27 blend modes; the
 * remaining 11 currently render in normal mode (a future build can swap in
 * the WebGL compositor for pixel-perfect output of those modes — the GLSL
 * shaders in @pef/filters are ready).
 */
export interface RenderOptions {
  doc: Document;
  ctx: CanvasRenderingContext2D;
  bitmapCache: Map<string, HTMLImageElement>;
}

export function renderDocument(opts: RenderOptions): void {
  const { doc, ctx, bitmapCache } = opts;
  ctx.save();
  // background
  const [br, bg, bb, ba] = doc.background;
  ctx.fillStyle = `rgba(${Math.round(br * 255)}, ${Math.round(bg * 255)}, ${Math.round(bb * 255)}, ${ba})`;
  ctx.fillRect(0, 0, doc.width, doc.height);

  for (const id of doc.layerOrder) {
    const layer = doc.layers[id];
    if (!layer || !layer.visible) continue;
    drawLayer(ctx, layer, bitmapCache);
  }
  ctx.restore();
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, bitmaps: Map<string, HTMLImageElement>): void {
  ctx.save();
  ctx.globalAlpha = layer.opacity;
  ctx.globalCompositeOperation = CANVAS2D_FALLBACK[layer.blendMode];

  const t = layer.transform;
  ctx.translate(t.position.x, t.position.y);
  ctx.rotate(t.rotation);
  ctx.scale(t.scale.x, t.scale.y);

  switch (layer.type) {
    case 'image':
      drawImageLayer(ctx, layer, bitmaps);
      break;
    case 'text':
      drawTextLayer(ctx, layer);
      break;
    case 'shape':
      drawShapeLayer(ctx, layer);
      break;
    case 'group':
      // groups render their children at their original positions; we don't
      // apply a group transform to children here because each child stores
      // absolute transforms in v1.
      break;
  }
  ctx.restore();
}

function drawImageLayer(ctx: CanvasRenderingContext2D, layer: ImageLayer, bitmaps: Map<string, HTMLImageElement>): void {
  const img = bitmaps.get(layer.bitmapId);
  if (!img) return;
  const w = layer.sourceWidth;
  const h = layer.sourceHeight;
  ctx.drawImage(img, -w * layer.transform.anchor.x, -h * layer.transform.anchor.y, w, h);
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer): void {
  const [r, g, b, a] = layer.color;
  ctx.fillStyle = `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${a})`;
  ctx.font = `${layer.fontStyle} ${layer.fontWeight} ${layer.fontSizePx}px "${layer.fontFamily}"`;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = layer.align === 'justify' ? 'left' : (layer.align as CanvasTextAlign);

  // letterSpacing isn't universally supported — fall back to per-char layout.
  const lines = layer.text.split(/\n/);
  let y = 0;
  for (const line of lines) {
    if (layer.letterSpacingEm === 0) {
      ctx.fillText(line, 0, y);
    } else {
      let x = 0;
      for (const ch of line) {
        ctx.fillText(ch, x, y);
        x += ctx.measureText(ch).width + layer.letterSpacingEm * layer.fontSizePx;
      }
    }
    y += layer.fontSizePx * layer.lineHeight;
  }
}

function drawShapeLayer(ctx: CanvasRenderingContext2D, layer: ShapeLayer): void {
  const w = layer.width;
  const h = layer.height;
  const [fr, fg, fb, fa] = layer.fill;
  const [sr, sg, sb, sa] = layer.stroke;
  ctx.fillStyle = `rgba(${Math.round(fr * 255)}, ${Math.round(fg * 255)}, ${Math.round(fb * 255)}, ${fa})`;
  ctx.strokeStyle = `rgba(${Math.round(sr * 255)}, ${Math.round(sg * 255)}, ${Math.round(sb * 255)}, ${sa})`;
  ctx.lineWidth = layer.strokeWidth;

  const ax = layer.transform.anchor.x;
  const ay = layer.transform.anchor.y;

  ctx.beginPath();
  switch (layer.shape) {
    case 'rectangle':
      roundRect(ctx, -w * ax, -h * ay, w, h, layer.cornerRadius);
      break;
    case 'ellipse':
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      break;
    case 'polygon': {
      const sides = Math.max(3, layer.sides);
      for (let i = 0; i < sides; i++) {
        const angle = (i / sides) * Math.PI * 2 - Math.PI / 2;
        const px = (Math.cos(angle) * w) / 2;
        const py = (Math.sin(angle) * h) / 2;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      break;
    }
  }
  ctx.fill();
  if (layer.strokeWidth > 0) ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/** Build/refresh a bitmap cache from a Document's bitmap registry. */
export async function loadBitmaps(doc: Document, cache: Map<string, HTMLImageElement>): Promise<void> {
  const promises: Promise<void>[] = [];
  for (const [id, dataUrl] of Object.entries(doc.bitmaps)) {
    if (cache.has(id)) continue;
    promises.push(
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          cache.set(id, img);
          resolve();
        };
        img.onerror = () => resolve();
        img.src = dataUrl;
      }),
    );
  }
  await Promise.all(promises);
}
