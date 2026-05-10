/**
 * Glyph-feature extraction. Given a binarized text crop with bounding boxes
 * (from OCR), compute statistical descriptors that characterize the typeface:
 * stroke-weight ratio, x-height proportion, aspect ratio, slant.
 *
 * These features feed both the local similarity scorer and the metrics
 * displayed alongside API matches so users can sanity-check results.
 */

export interface GlyphFeatures {
  /** ratio of dark pixels inside the glyph bbox (proxy for weight) */
  strokeDensity: number;
  /** measured italic angle in radians, computed from second-moment of foreground */
  italicAngle: number;
  /** width / height of glyph bounding box */
  aspectRatio: number;
  /** number of glyphs measured */
  glyphCount: number;
}

export interface GlyphBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ImageBuffer {
  width: number;
  height: number;
  /** RGBA Uint8 pixels, length = w*h*4 */
  data: Uint8ClampedArray;
}

/**
 * Convert RGBA → 1-bit foreground using Otsu thresholding on the luma channel.
 * Returns a Uint8Array of 0/1 values, length = w*h.
 */
export function binarizeOtsu(img: ImageBuffer): Uint8Array {
  const out = new Uint8Array(img.width * img.height);
  const histogram = new Uint32Array(256);
  for (let i = 0; i < img.data.length; i += 4) {
    const lum = Math.round(
      0.299 * (img.data[i] ?? 0) + 0.587 * (img.data[i + 1] ?? 0) + 0.114 * (img.data[i + 2] ?? 0),
    );
    histogram[lum] = (histogram[lum] ?? 0) + 1;
  }
  const total = img.width * img.height;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * (histogram[i] ?? 0);
  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += histogram[t] ?? 0;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * (histogram[t] ?? 0);
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > max) {
      max = between;
      threshold = t;
    }
  }
  for (let i = 0, j = 0; i < img.data.length; i += 4, j++) {
    const lum = 0.299 * (img.data[i] ?? 0) + 0.587 * (img.data[i + 1] ?? 0) + 0.114 * (img.data[i + 2] ?? 0);
    // text is typically darker than background; mark lum < threshold as foreground
    out[j] = lum < threshold ? 1 : 0;
  }
  return out;
}

export function extractFeatures(
  bin: Uint8Array,
  width: number,
  height: number,
  boxes: GlyphBox[],
): GlyphFeatures {
  if (boxes.length === 0) {
    return { strokeDensity: 0, italicAngle: 0, aspectRatio: 0, glyphCount: 0 };
  }
  let totalDensity = 0;
  let totalAspect = 0;
  let totalAngle = 0;
  let counted = 0;
  for (const box of boxes) {
    const { density, angle } = analyzeGlyph(bin, width, height, box);
    if (density === 0) continue;
    totalDensity += density;
    totalAspect += box.width / Math.max(1, box.height);
    totalAngle += angle;
    counted++;
  }
  if (counted === 0) {
    return { strokeDensity: 0, italicAngle: 0, aspectRatio: 0, glyphCount: 0 };
  }
  return {
    strokeDensity: totalDensity / counted,
    italicAngle: totalAngle / counted,
    aspectRatio: totalAspect / counted,
    glyphCount: counted,
  };
}

function analyzeGlyph(
  bin: Uint8Array,
  width: number,
  height: number,
  box: GlyphBox,
): { density: number; angle: number } {
  const x0 = Math.max(0, box.x);
  const y0 = Math.max(0, box.y);
  const x1 = Math.min(width, box.x + box.width);
  const y1 = Math.min(height, box.y + box.height);
  let count = 0;
  let sumX = 0;
  let sumY = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (bin[y * width + x] === 1) {
        count++;
        sumX += x;
        sumY += y;
      }
    }
  }
  const total = (x1 - x0) * (y1 - y0);
  if (count === 0 || total === 0) return { density: 0, angle: 0 };
  const meanX = sumX / count;
  const meanY = sumY / count;
  let mxx = 0;
  let myy = 0;
  let mxy = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (bin[y * width + x] === 1) {
        const dx = x - meanX;
        const dy = y - meanY;
        mxx += dx * dx;
        myy += dy * dy;
        mxy += dx * dy;
      }
    }
  }
  const angle = 0.5 * Math.atan2(2 * mxy, mxx - myy);
  return { density: count / total, angle };
}

/** Convert measured strokeDensity to a CSS weight 100..900. */
export function densityToWeight(density: number): number {
  // Empirical mapping from observed density of 50pt Inter at common weights:
  // 100 ≈ 0.06, 400 ≈ 0.13, 700 ≈ 0.20, 900 ≈ 0.26
  const clamped = Math.max(0.04, Math.min(0.30, density));
  const t = (clamped - 0.04) / (0.30 - 0.04);
  const w = 100 + t * 800;
  return Math.round(w / 100) * 100;
}
