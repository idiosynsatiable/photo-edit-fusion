/**
 * 8-bit raster mask. 0 = fully outside, 255 = fully inside, intermediate
 * values are anti-aliased edges and feathered selections.
 */

export interface Mask {
  width: number;
  height: number;
  data: Uint8ClampedArray; // length = width * height
}

export function createMask(width: number, height: number): Mask {
  return { width, height, data: new Uint8ClampedArray(width * height) };
}

export function fillMask(mask: Mask, value: number): void {
  mask.data.fill(value);
}

export function invertMask(mask: Mask): void {
  for (let i = 0; i < mask.data.length; i++) {
    mask.data[i] = 255 - (mask.data[i] ?? 0);
  }
}

/** Apply a mask to ImageData in place: alpha = source.alpha * mask/255. */
export function applyMaskToImage(img: ImageData, mask: Mask): void {
  if (img.width !== mask.width || img.height !== mask.height) {
    throw new Error('Mask dimensions do not match image');
  }
  for (let i = 0, j = 0; i < img.data.length; i += 4, j++) {
    const m = (mask.data[j] ?? 0) / 255;
    img.data[i + 3] = Math.round((img.data[i + 3] ?? 0) * m);
  }
}

/** Feather a hard mask using box-blur passes for soft edges. */
export function featherMask(mask: Mask, radiusPx: number): void {
  const r = Math.max(0, Math.round(radiusPx));
  if (r === 0) return;
  for (let pass = 0; pass < 3; pass++) {
    boxH(mask, r);
    boxV(mask, r);
  }
}

function boxH(mask: Mask, r: number): void {
  const { width, height, data } = mask;
  const out = new Uint8ClampedArray(data.length);
  const window = r * 2 + 1;
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += data[y * width + Math.max(0, Math.min(width - 1, i))] ?? 0;
    for (let x = 0; x < width; x++) {
      out[y * width + x] = Math.round(sum / window);
      sum +=
        (data[y * width + Math.min(width - 1, x + r + 1)] ?? 0) -
        (data[y * width + Math.max(0, x - r)] ?? 0);
    }
  }
  data.set(out);
}

function boxV(mask: Mask, r: number): void {
  const { width, height, data } = mask;
  const out = new Uint8ClampedArray(data.length);
  const window = r * 2 + 1;
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let i = -r; i <= r; i++) sum += data[Math.max(0, Math.min(height - 1, i)) * width + x] ?? 0;
    for (let y = 0; y < height; y++) {
      out[y * width + x] = Math.round(sum / window);
      sum +=
        (data[Math.min(height - 1, y + r + 1) * width + x] ?? 0) -
        (data[Math.max(0, y - r) * width + x] ?? 0);
    }
  }
  data.set(out);
}
