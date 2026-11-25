/** Add print density without re-encoding the pixels. */
function crc32(data: Uint8Array): number { let crc = 0xffffffff; for (const byte of data) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }
export function stampDensity(bytes: Uint8Array, format: 'png' | 'jpeg' | 'webp', ppi: number): Uint8Array {
  if (!Number.isInteger(ppi) || ppi < 1 || ppi > 1200) throw new Error('Use a print resolution from 1–1200 PPI.');
  if (format === 'webp') return bytes;
  if (format === 'jpeg') {
    if (bytes[0] !== 255 || bytes[1] !== 216) throw new Error('Invalid JPEG encoding.');
    const out = bytes.slice(); let offset = 2;
    while (offset + 4 < out.length && out[offset] === 255) {
      const marker = out[offset+1]!, length = (out[offset+2]! << 8) | out[offset+3]!;
      if (marker === 0xda || marker === 0xd9 || length < 2) break;
      if (marker === 0xe0 && length >= 16 && String.fromCharCode(...out.subarray(offset+4,offset+9)) === 'JFIF\0') {
        out[offset+11] = 1; out[offset+12] = ppi >> 8; out[offset+13] = ppi & 255; out[offset+14] = ppi >> 8; out[offset+15] = ppi & 255; return out;
      }
      offset += length + 2;
    }
    const jfif = new Uint8Array([255,224,0,16,74,70,73,70,0,1,1,1,ppi >> 8,ppi & 255,ppi >> 8,ppi & 255,0,0]);
    const merged = new Uint8Array(bytes.length + jfif.length); merged.set(bytes.subarray(0,2)); merged.set(jfif,2); merged.set(bytes.subarray(2),2+jfif.length); return merged;
  }
  if (![137,80,78,71,13,10,26,10].every((v,i) => bytes[i] === v)) throw new Error('Invalid PNG encoding.');
  const chunk = new Uint8Array(21), view = new DataView(chunk.buffer), ppm = Math.round(ppi / .0254);
  view.setUint32(0,9); chunk.set([112,72,89,115],4); view.setUint32(8,ppm); view.setUint32(12,ppm); chunk[16] = 1; view.setUint32(17,crc32(chunk.subarray(4,17)));
  const parts: Uint8Array[] = [bytes.subarray(0,8)]; let offset = 8, added = false;
  const source = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  while (offset+12 <= bytes.length) {
    const length = source.getUint32(offset), end = offset+12+length; if (end > bytes.length) throw new Error('Truncated PNG chunk.');
    const type = String.fromCharCode(...bytes.subarray(offset+4,offset+8));
    if (!added && type === 'IDAT') { parts.push(chunk); added = true; }
    if (type !== 'pHYs') parts.push(bytes.subarray(offset,end)); offset = end;
  }
  const result = new Uint8Array(parts.reduce((n,part) => n+part.length,0)); let at = 0;
  for (const part of parts) { result.set(part,at); at += part.length; } return result;
}
