/**
 * Pixel-level adjustment helpers (brightness, contrast, saturation, hue, levels,
 * gaussian blur). Adjustments operate in-place on ImageData for simplicity;
 * the canvas engine wraps these into adjustment layers when needed.
 */

export function brightnessContrast(img: ImageData, brightness: number, contrast: number): void {
  // brightness in [-1,1], contrast in [-1,1]
  const c = (1 + contrast) / (1 - contrast + 1e-6);
  for (let i = 0; i < img.data.length; i += 4) {
    for (let k = 0; k < 3; k++) {
      const v = (img.data[i + k] ?? 0) / 255;
      const out = (v - 0.5) * c + 0.5 + brightness;
      img.data[i + k] = clamp255(out * 255);
    }
  }
}

export function saturate(img: ImageData, amount: number): void {
  // amount in [-1, 1]; -1 grayscale, 0 unchanged, +1 doubled saturation
  const s = 1 + amount;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = (img.data[i] ?? 0) / 255;
    const g = (img.data[i + 1] ?? 0) / 255;
    const b = (img.data[i + 2] ?? 0) / 255;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    img.data[i] = clamp255((lum + (r - lum) * s) * 255);
    img.data[i + 1] = clamp255((lum + (g - lum) * s) * 255);
    img.data[i + 2] = clamp255((lum + (b - lum) * s) * 255);
  }
}

export function hueShift(img: ImageData, degrees: number): void {
  const rad = (degrees * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  // YIQ rotation matrix
  const m00 = 0.299 + 0.701 * c + 0.168 * s;
  const m01 = 0.587 - 0.587 * c + 0.33 * s;
  const m02 = 0.114 - 0.114 * c - 0.497 * s;
  const m10 = 0.299 - 0.299 * c - 0.328 * s;
  const m11 = 0.587 + 0.413 * c + 0.035 * s;
  const m12 = 0.114 - 0.114 * c + 0.292 * s;
  const m20 = 0.299 - 0.3 * c + 1.25 * s;
  const m21 = 0.587 - 0.588 * c - 1.05 * s;
  const m22 = 0.114 + 0.886 * c - 0.203 * s;
  for (let i = 0; i < img.data.length; i += 4) {
    const r = img.data[i] ?? 0;
    const g = img.data[i + 1] ?? 0;
    const b = img.data[i + 2] ?? 0;
    img.data[i] = clamp255(m00 * r + m01 * g + m02 * b);
    img.data[i + 1] = clamp255(m10 * r + m11 * g + m12 * b);
    img.data[i + 2] = clamp255(m20 * r + m21 * g + m22 * b);
  }
}

export function gaussianBlur(img: ImageData, radiusPx: number): void {
  // separable box-blur approximation with three passes of equal size
  const r = Math.max(0, Math.round(radiusPx));
  if (r === 0) return;
  for (let pass = 0; pass < 3; pass++) {
    boxBlurH(img, r);
    boxBlurV(img, r);
  }
}

function boxBlurH(img: ImageData, r: number): void {
  const { data, width, height } = img;
  const out = new Uint8ClampedArray(data.length);
  const window = r * 2 + 1;
  for (let y = 0; y < height; y++) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumA = 0;
    for (let i = -r; i <= r; i++) {
      const xi = Math.max(0, Math.min(width - 1, i));
      const idx = (y * width + xi) * 4;
      sumR += data[idx] ?? 0;
      sumG += data[idx + 1] ?? 0;
      sumB += data[idx + 2] ?? 0;
      sumA += data[idx + 3] ?? 0;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      out[o] = Math.round(sumR / window);
      out[o + 1] = Math.round(sumG / window);
      out[o + 2] = Math.round(sumB / window);
      out[o + 3] = Math.round(sumA / window);
      const subIdx = (y * width + Math.max(0, x - r)) * 4;
      const addIdx = (y * width + Math.min(width - 1, x + r + 1)) * 4;
      sumR += (data[addIdx] ?? 0) - (data[subIdx] ?? 0);
      sumG += (data[addIdx + 1] ?? 0) - (data[subIdx + 1] ?? 0);
      sumB += (data[addIdx + 2] ?? 0) - (data[subIdx + 2] ?? 0);
      sumA += (data[addIdx + 3] ?? 0) - (data[subIdx + 3] ?? 0);
    }
  }
  data.set(out);
}

function boxBlurV(img: ImageData, r: number): void {
  const { data, width, height } = img;
  const out = new Uint8ClampedArray(data.length);
  const window = r * 2 + 1;
  for (let x = 0; x < width; x++) {
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumA = 0;
    for (let i = -r; i <= r; i++) {
      const yi = Math.max(0, Math.min(height - 1, i));
      const idx = (yi * width + x) * 4;
      sumR += data[idx] ?? 0;
      sumG += data[idx + 1] ?? 0;
      sumB += data[idx + 2] ?? 0;
      sumA += data[idx + 3] ?? 0;
    }
    for (let y = 0; y < height; y++) {
      const o = (y * width + x) * 4;
      out[o] = Math.round(sumR / window);
      out[o + 1] = Math.round(sumG / window);
      out[o + 2] = Math.round(sumB / window);
      out[o + 3] = Math.round(sumA / window);
      const subIdx = (Math.max(0, y - r) * width + x) * 4;
      const addIdx = (Math.min(height - 1, y + r + 1) * width + x) * 4;
      sumR += (data[addIdx] ?? 0) - (data[subIdx] ?? 0);
      sumG += (data[addIdx + 1] ?? 0) - (data[subIdx + 1] ?? 0);
      sumB += (data[addIdx + 2] ?? 0) - (data[subIdx + 2] ?? 0);
      sumA += (data[addIdx + 3] ?? 0) - (data[subIdx + 3] ?? 0);
    }
  }
  data.set(out);
}

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}
