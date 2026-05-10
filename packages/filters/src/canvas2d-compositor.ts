import type { BlendMode } from '@pef/shared';
import { CANVAS2D_FALLBACK, WEBGL_REQUIRED } from '@pef/shared';
import { blendPixel, type RGBA } from './blend-cpu.js';

/**
 * Composite a single layer onto a Canvas2D context. For modes that have a
 * native globalCompositeOperation equivalent the native path is used (fast).
 * For modes that don't (vivid-light, linear-light, hard-mix, etc.) we fall
 * back to a per-pixel CPU loop using blendPixel().
 */
export function compositeCanvas2D(
  base: CanvasRenderingContext2D,
  src: HTMLCanvasElement | OffscreenCanvas | HTMLImageElement,
  mode: BlendMode,
  opacity: number,
  x = 0,
  y = 0,
): void {
  if (!WEBGL_REQUIRED.has(mode)) {
    base.save();
    base.globalAlpha = opacity;
    base.globalCompositeOperation = CANVAS2D_FALLBACK[mode];
    base.drawImage(src as CanvasImageSource, x, y);
    base.restore();
    return;
  }
  // CPU per-pixel path — used only for modes Canvas2D can't express natively.
  const w = (src as HTMLCanvasElement).width || (src as HTMLImageElement).width;
  const h = (src as HTMLCanvasElement).height || (src as HTMLImageElement).height;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;
  tctx.drawImage(src as CanvasImageSource, 0, 0);
  const srcImg = tctx.getImageData(0, 0, w, h);
  const baseImg = base.getImageData(x, y, w, h);
  const out = base.createImageData(w, h);
  for (let i = 0; i < baseImg.data.length; i += 4) {
    const b: RGBA = [
      (baseImg.data[i] ?? 0) / 255,
      (baseImg.data[i + 1] ?? 0) / 255,
      (baseImg.data[i + 2] ?? 0) / 255,
      (baseImg.data[i + 3] ?? 0) / 255,
    ];
    const s: RGBA = [
      (srcImg.data[i] ?? 0) / 255,
      (srcImg.data[i + 1] ?? 0) / 255,
      (srcImg.data[i + 2] ?? 0) / 255,
      (srcImg.data[i + 3] ?? 0) / 255,
    ];
    const r = blendPixel(mode, b, s, opacity);
    out.data[i] = Math.round(r[0] * 255);
    out.data[i + 1] = Math.round(r[1] * 255);
    out.data[i + 2] = Math.round(r[2] * 255);
    out.data[i + 3] = Math.round(r[3] * 255);
  }
  base.putImageData(out, x, y);
}
