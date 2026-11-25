import { paintText, ensureProjectFonts } from './typography.js';
import { correctPixels } from './color-transfer.js';
import { compositeCanvas2D } from '@pef/filters';
import { CANVAS2D_FALLBACK, WEBGL_REQUIRED } from '@pef/shared';
import type { Document, Layer, ImageLayer, ImageAdjustments, ShapeLayer, TextLayer } from '@pef/shared';

/**
 * Canvas2D-based renderer. Walks the layer order and draws each layer onto
 * the destination context, applying transform, blend mode, and opacity. The
 * native globalCompositeOperation path covers 16 of the 27 blend modes; the
 * remaining modes use a CPU compositor at the same render scale.
 */
export interface RenderOptions {
  doc: Document;
  ctx: CanvasRenderingContext2D;
  bitmapCache: Map<string, HTMLImageElement | HTMLCanvasElement>;
}

export function renderDocument(opts: RenderOptions): void {
  const { doc, ctx, bitmapCache } = opts;
  ctx.save();
  ctx.clearRect(0, 0, doc.width, doc.height);
  // background
  const [br, bg, bb, ba] = doc.background;
  ctx.fillStyle = `rgba(${Math.round(br * 255)}, ${Math.round(bg * 255)}, ${Math.round(bb * 255)}, ${ba})`;
  ctx.fillRect(0, 0, doc.width, doc.height);

  for (const id of doc.layerOrder) {
    const layer = doc.layers[id];
    if (!layer || !layer.visible) continue;
    if (WEBGL_REQUIRED.has(layer.blendMode)) {
      const raster = document.createElement('canvas'); raster.width = ctx.canvas.width; raster.height = ctx.canvas.height;
      const rctx = raster.getContext('2d');
      if (rctx) { rctx.setTransform(ctx.getTransform()); drawLayer(rctx, { ...layer, blendMode: 'normal', opacity: 1 }, bitmapCache); compositeCanvas2D(ctx, raster, layer.blendMode, layer.opacity); }
    } else drawLayer(ctx, layer, bitmapCache);
  }
  ctx.restore();
}

function drawLayer(ctx: CanvasRenderingContext2D, layer: Layer, bitmaps: Map<string, HTMLImageElement | HTMLCanvasElement>): void {
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

function drawImageLayer(ctx: CanvasRenderingContext2D, layer: ImageLayer, bitmaps: Map<string, HTMLImageElement | HTMLCanvasElement>): void {
  const original = bitmaps.get(layer.bitmapId);
  const img = original ? correctedBitmap(original, layer.harmonization, layer.adjustments) : undefined;
  if (!img) return;
  const w = layer.sourceWidth;
  const h = layer.sourceHeight;
  const x = -w * layer.transform.anchor.x;
  const y = -h * layer.transform.anchor.y;
  const mask = layer.maskBitmapId ? bitmaps.get(layer.maskBitmapId) : undefined;
  const a = layer.adjustments;
  if (a && !layer.harmonization?.strength) ctx.filter = adjustmentFilter(a);

  if (!mask && !layer.featherPx) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }

  // Apply raster masks non-destructively in source-pixel space. The original
  // bitmap remains untouched, and changing/removing maskBitmapId restores it.
  const masked = document.createElement('canvas');
  masked.width = w;
  masked.height = h;
  const maskCtx = masked.getContext('2d');
  if (!maskCtx) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  maskCtx.drawImage(img, 0, 0, w, h);
  maskCtx.globalCompositeOperation = 'destination-in';
  if (layer.featherPx) {
    const feather = document.createElement('canvas'), pad = Math.ceil(layer.featherPx * 3);
    feather.width = w + pad * 2; feather.height = h + pad * 2;
    const fctx = feather.getContext('2d')!; fctx.filter = 'blur(' + layer.featherPx + 'px)';
    if (mask) fctx.drawImage(mask,pad,pad,w,h); else { fctx.fillStyle = '#fff'; fctx.fillRect(pad,pad,w,h); }
    maskCtx.drawImage(feather,-pad,-pad);
  } else if (mask) maskCtx.drawImage(mask,0,0,w,h);
  maskCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(masked, x, y, w, h);
}

function drawTextLayer(ctx: CanvasRenderingContext2D, layer: TextLayer): void { paintText(ctx, layer); }

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
export async function loadBitmaps(doc: Document, cache: Map<string, HTMLImageElement | HTMLCanvasElement>): Promise<void> {
  const promises: Promise<void>[] = [];
  const used = new Set<string>();
  for (const layer of Object.values(doc.layers)) {
    if (layer.type === 'image') used.add(layer.bitmapId);
    if (layer.maskBitmapId) used.add(layer.maskBitmapId);
  }
  for (const id of cache.keys()) if (!used.has(id)) cache.delete(id);
  for (const [id, dataUrl] of Object.entries(doc.bitmaps)) {
    if (!used.has(id)) continue;
    const existing = cache.get(id);
    if (existing instanceof HTMLImageElement && existing.src === dataUrl) continue;
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
  await Promise.all([...promises, ensureProjectFonts(doc)]);
}

function adjustmentFilter(a: ImageAdjustments): string {
  return 'brightness(' + (1+a.brightness) + ') contrast(' + (1+a.contrast) + ') saturate(' + (1+a.saturation) + ') grayscale(' + a.grayscale + ') sepia(' + a.sepia + ') blur(' + a.blur + 'px)';
}
const corrections = new WeakMap<HTMLImageElement | HTMLCanvasElement,{key:string;canvas:HTMLCanvasElement}>();
function correctedBitmap(source: HTMLImageElement | HTMLCanvasElement, effect: ImageLayer['harmonization'], adjustments: ImageLayer['adjustments']): HTMLImageElement | HTMLCanvasElement {
  if (!effect?.strength) return source;
  const key = JSON.stringify({ effect, adjustments }), cached = corrections.get(source); if (cached?.key === key) return cached.canvas;
  const canvas = document.createElement('canvas'); canvas.width = source.width; canvas.height = source.height;
  const ctx = canvas.getContext('2d',{willReadFrequently:true})!; if (adjustments) ctx.filter = adjustmentFilter(adjustments); ctx.drawImage(source,0,0);
  const image = ctx.getImageData(0,0,canvas.width,canvas.height); correctPixels(image.data,effect); ctx.putImageData(image,0,0);
  corrections.set(source,{key,canvas}); return canvas;
}
