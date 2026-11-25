import type { ImageLayer } from '@pef/shared';
export type Correction = NonNullable<ImageLayer['harmonization']>;
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
function statistics(values: number[]): { mean: number; sd: number } {
  values.sort((a,b) => a-b);
  const trimmed = values.slice(Math.floor(values.length * .03), Math.ceil(values.length * .97));
  const mean = trimmed.reduce((s,v) => s+v,0) / trimmed.length;
  return { mean, sd: Math.sqrt(trimmed.reduce((s,v) => s+(v-mean)**2,0) / trimmed.length) };
}
export function estimateCorrection(source: Uint8ClampedArray, reference: Uint8ClampedArray): Correction {
  const src: number[][] = [[],[],[]], dst: number[][] = [[],[],[]];
  for (let i = 0; i < source.length; i += 4) {
    if (source[i+3]! < 180 || reference[i+3]! < 180) continue;
    for (let c = 0; c < 3; c++) { src[c]!.push(source[i+c]!); dst[c]!.push(reference[i+c]!); }
  }
  if (src[0]!.length < 64) throw new Error('Not enough overlap. Move this photo over a visible image beneath it, then try again.');
  const gain: [number,number,number] = [1,1,1], bias: [number,number,number] = [0,0,0];
  for (let c = 0; c < 3; c++) { const a = statistics(src[c]!), b = statistics(dst[c]!); gain[c] = a.sd < 5 || b.sd < 5 ? 1 : clamp(b.sd/a.sd,.55,1.8); bias[c] = clamp(b.mean-a.mean*gain[c]!,-160,160); }
  return { gain,bias,strength:.65 };
}
export function correctPixels(data: Uint8ClampedArray, effect: Correction): void {
  for (let i = 0; i < data.length; i += 4) for (let c = 0; c < 3; c++) { const v = data[i+c]!; data[i+c] = clamp(v + effect.strength * (v * effect.gain[c]! + effect.bias[c]! - v),0,255); }
}
