import type { TextLayer } from '@pef/shared';
import type { FontCandidate } from './font-catalog.js';
import { measureInk, paintText } from './typography.js';
export interface InkSample { mask: Uint8ClampedArray; width: number; height: number; x: number; y: number; color: [number, number, number, number]; contrast: number }
export interface VisualMatch { family: string; weight: number; style: 'normal' | 'italic'; tracking: number; score: number; size: number; scaleX: number; metrics: NonNullable<TextLayer['inkMetrics']> }
const luma = (r: number, g: number, b: number) => .2126 * r + .7152 * g + .0722 * b;
const median = (a: number[]) => a.sort((x, y) => x - y)[Math.floor(a.length / 2)] ?? 0;
/** Otsu segmentation with border-derived polarity and transparent-background support. */
export function sampleInk(image: ImageData): InkSample {
  const { width, height, data } = image, hist = new Uint32Array(256), border: number[] = [];
  let total = 0, sum = 0, transparent = 0;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const i = (y * width + x) * 4, v = Math.round(luma(data[i]!, data[i + 1]!, data[i + 2]!));
    if (data[i + 3]! < 16) { transparent++; continue; }
    hist[v] = hist[v]! + 1; total++; sum += v;
    if (x < 2 || y < 2 || x >= width - 2 || y >= height - 2) border.push(v);
  }
  let back = 0, backSum = 0, variance = -1, threshold = 128;
  for (let v = 0; v < 256; v++) {
    back += hist[v]!; backSum += v * hist[v]!;
    if (!back || back === total) continue;
    const d = backSum / back - (sum - backSum) / (total - back), score = back * (total - back) * d * d;
    if (score > variance) { variance = score; threshold = v; }
  }
  const bg = median(border), lightBackground = bg > threshold, alphaOnly = transparent > width * height * .25;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  const full = new Uint8ClampedArray(width * height), colors: number[][] = [[], [], []], levels: number[] = [];
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const p = y * width + x, i = p * 4, v = luma(data[i]!, data[i + 1]!, data[i + 2]!);
    if (data[i + 3]! > 127 && (alphaOnly || (lightBackground ? v <= threshold : v > threshold))) {
      full[p] = 255; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      if (colors[0]!.length < 10000) { for (let c = 0; c < 3; c++) colors[c]!.push(data[i + c]!); levels.push(v); }
    }
  }
  if (maxX < minX || maxY < minY || colors[0]!.length < 4) throw new Error('No clear lettering found. Select one straight line with some background around it.');
  const w = maxX - minX + 1, h = maxY - minY + 1, mask = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) mask.set(full.subarray((minY + y) * width + minX, (minY + y) * width + minX + w), y * w);
  return { mask, width: w, height: h, x: minX, y: minY, color: [median(colors[0]!) / 255, median(colors[1]!) / 255, median(colors[2]!) / 255, 1], contrast: alphaOnly ? 255 : Math.abs(bg - median(levels)) };
}
function normalize(mask: Uint8ClampedArray, width: number, height: number, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const sx = Math.round((x + dx) * (width - 1) / Math.max(1, w - 1)), sy = Math.round((y + dy) * (height - 1) / Math.max(1, h - 1));
      if (sx >= 0 && sy >= 0 && sx < width && sy < height) sum += mask[sy * width + sx]! / 255;
    }
    out[y * w + x] = sum / 9;
  }
  return out;
}
/** Pixel comparison against actual rendered glyphs; score is not an identity probability. */
export async function fitVisualFont(sample: InkSample, text: string, fonts: FontCandidate[], signal: AbortSignal, progress: (fraction: number) => void): Promise<VisualMatch[]> {
  if (!text.trim() || text.includes('\n')) throw new Error('Fit one line at a time. Correct its wording first.');
  const h = 44, w = Math.min(900, Math.max(20, Math.round(sample.width / sample.height * h))), target = normalize(sample.mask, sample.width, sample.height, w, h);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx) throw new Error('Font matching unavailable.');
  function candidate(family: string, weight: number, style: 'normal' | 'italic', tracking: number): VisualMatch {
    const layer = { text, fontFamily: family, fontWeight: weight, fontStyle: style, fontSizePx: 100, letterSpacingEm: tracking, lineHeight: 1.2, align: 'left', color: [0,0,0,1], transform: { anchor: { x: 0, y: 0 } } } as TextLayer;
    const metrics = measureInk(layer)!; layer.inkMetrics = metrics;
    ctx!.setTransform(1,0,0,1,0,0); ctx!.clearRect(0,0,w,h); ctx!.save(); ctx!.scale(w / (metrics.width * 100), h / (metrics.height * 100)); paintText(ctx!, layer); ctx!.restore();
    const pixels = ctx!.getImageData(0,0,w,h).data, mask = new Uint8ClampedArray(w * h);
    for (let i = 0; i < mask.length; i++) mask[i] = pixels[i * 4 + 3]! > 100 ? 255 : 0;
    const rendered = normalize(mask,w,h,w,h); let diff = 0, mass = 0;
    for (let i = 0; i < target.length; i++) { diff += Math.abs(target[i]! - rendered[i]!); mass += target[i]! + rendered[i]!; }
    const ratio = (metrics.width / metrics.height) / (sample.width / sample.height), score = Math.max(0, 1 - diff / Math.max(1,mass) - .08 * Math.abs(Math.log(ratio))), size = sample.height / metrics.height;
    return { family, weight, style, tracking, score, metrics, size, scaleX: sample.width / (metrics.width * size) };
  }
  const all: VisualMatch[] = []; let count = 0;
  const total = fonts.reduce((n,font) => n + font.weights.length * font.styles.length,0);
  for (const font of fonts) for (const style of font.styles) for (const weight of font.weights) {
    if (signal.aborted) throw new DOMException('Cancelled','AbortError');
    all.push(candidate(font.family,weight,style,0)); progress(++count / total * .8);
    if (count % 8 === 0) await new Promise((resolve) => setTimeout(resolve,0));
  }
  all.sort((a,b) => b.score - a.score); const shortlist = all.slice(0,6);
  for (let i = 0; i < shortlist.length; i++) {
    const c = shortlist[i]!;
    for (const tracking of [-.06,-.04,-.02,.02,.04,.06,.08,.12]) { if (signal.aborted) throw new DOMException('Cancelled','AbortError'); all.push(candidate(c.family,c.weight,c.style,tracking)); }
    progress(.8 + .2 * (i + 1) / shortlist.length); await new Promise((resolve) => setTimeout(resolve,0));
  }
  const distinct = new Set<string>();
  return all.sort((a,b) => b.score - a.score).filter((m) => { const key = m.family + m.style; if (distinct.has(key)) return false; distinct.add(key); return true; }).slice(0,5);
}
