import type { Document as EditorDocument, TextLayer } from '@pef/shared';
import { FONT_CATALOG, type FontCandidate } from './font-catalog.js';
export function fontString(layer: Pick<TextLayer, 'fontStyle' | 'fontWeight' | 'fontSizePx' | 'fontFamily'>): string {
  const family = layer.fontFamily.includes(',') || layer.fontFamily.includes('"') ? layer.fontFamily : '"' + layer.fontFamily + '"';
  return layer.fontStyle + ' ' + layer.fontWeight + ' ' + layer.fontSizePx + 'px ' + family;
}
export function measureInk(layer: Pick<TextLayer, 'text' | 'fontFamily' | 'fontWeight' | 'fontStyle' | 'letterSpacingEm' | 'lineHeight'>): TextLayer['inkMetrics'] {
  const ctx = document.createElement('canvas').getContext('2d'); if (!ctx) return undefined;
  ctx.font = fontString({ ...layer, fontSizePx: 100 });
  const lines = layer.text.split('\n');
  const metrics = lines.map((text) => {
    if (!layer.letterSpacingEm) { const m = ctx.measureText(text || ' '); return { left: m.actualBoundingBoxLeft || 0, right: m.actualBoundingBoxRight || m.width, ascent: m.actualBoundingBoxAscent || 75, descent: m.actualBoundingBoxDescent || 0 }; }
    let advance = 0, left = 0, right = 0, ascent = 0, descent = 0;
    for (const ch of text) { const m = ctx.measureText(ch); left = Math.max(left, (m.actualBoundingBoxLeft || 0) - advance); right = Math.max(right, advance + (m.actualBoundingBoxRight || m.width)); ascent = Math.max(ascent, m.actualBoundingBoxAscent || 0); descent = Math.max(descent, m.actualBoundingBoxDescent || 0); advance += m.width + layer.letterSpacingEm * 100; }
    return { left, right, ascent: ascent || 75, descent };
  });
  const left = Math.max(0, ...metrics.map((m) => m.left)), ascent = Math.max(1, ...metrics.map((m) => m.ascent)), descent = Math.max(0, ...metrics.map((m) => m.descent));
  return { width: Math.max(1, ...metrics.map((m) => m.right + left)) / 100, height: (ascent + descent + (lines.length - 1) * layer.lineHeight * 100) / 100, left: left / 100, ascent: ascent / 100 };
}
const loaded = new Map<string, Promise<void>>();
export async function ensureProjectFonts(doc: EditorDocument): Promise<void> {
  for (const [id, asset] of Object.entries(doc.fonts ?? {})) {
    const key = id + asset.dataUrl;
    if (!loaded.has(key)) loaded.set(key, (async () => { const face = new FontFace(asset.family, 'url("' + asset.dataUrl + '")', { weight: asset.weight, style: asset.style }); await face.load(); document.fonts.add(face); })().catch((error) => { loaded.delete(key); throw error; }));
    await loaded.get(key);
  }
  await Promise.all(Object.values(doc.layers).filter((l): l is TextLayer => l.type === 'text').map((l) => document.fonts.load(fontString(l), l.text || 'Sample')));
}
export async function matchingCandidates(doc: EditorDocument): Promise<FontCandidate[]> {
  await ensureProjectFonts(doc);
  const fonts: FontCandidate[] = [...FONT_CATALOG];
  for (const asset of Object.values(doc.fonts ?? {})) if (!fonts.some((font) => font.family === asset.family)) fonts.push({ family: asset.family, weights: asset.weight.includes(' ') ? [300,400,500,600,700,800] : [Number(asset.weight) || 400], styles: [asset.style] });
  await Promise.all(fonts.flatMap((font) => font.styles.map((style) => document.fonts.load(style + ' 400 64px "' + font.family + '"', 'Hamburgefonts 123'))));
  return fonts;
}
export function paintText(ctx: CanvasRenderingContext2D, layer: TextLayer): void {
  ctx.font = fontString(layer); ctx.textAlign = 'left';
  const lines = layer.text.split('\n'), m = layer.inkMetrics;
  const w = m ? m.width * layer.fontSizePx : Math.max(1, ...lines.map((line) => line.length)) * layer.fontSizePx * .55;
  const h = m ? m.height * layer.fontSizePx : lines.length * layer.fontSizePx * layer.lineHeight;
  const ox = -w * layer.transform.anchor.x;
  let y = -h * layer.transform.anchor.y + (m ? m.ascent * layer.fontSizePx : 0);
  ctx.textBaseline = m ? 'alphabetic' : 'top';
  const css = (c: number[]) => 'rgba(' + c[0]! * 255 + ',' + c[1]! * 255 + ',' + c[2]! * 255 + ',' + c[3] + ')';
  ctx.fillStyle = css(layer.color);
  if (layer.shadow) { ctx.shadowColor = css(layer.shadow.color); ctx.shadowBlur = layer.shadow.blur; ctx.shadowOffsetX = layer.shadow.x; ctx.shadowOffsetY = layer.shadow.y; }
  ctx.lineJoin = 'round';
  if (layer.outline) { ctx.strokeStyle = css(layer.outline.color); ctx.lineWidth = layer.outline.width * 2; }
  for (const line of lines) {
    const tracking = layer.letterSpacingEm * layer.fontSizePx;
    const lineWidth = tracking ? [...line].reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) + Math.max(0, [...line].length - 1) * tracking : ctx.measureText(line).width;
    let x = ox + (m ? m.left * layer.fontSizePx : 0) + (layer.align === 'center' ? (w - lineWidth) / 2 : layer.align === 'right' ? w - lineWidth : 0);
    const draw = (text: string, at: number) => { if (layer.outline?.width) ctx.strokeText(text, at, y); ctx.fillText(text, at, y); };
    if (!tracking) draw(line, x); else for (const ch of line) { draw(ch, x); x += ctx.measureText(ch).width + tracking; }
    y += layer.fontSizePx * layer.lineHeight;
  }
}
